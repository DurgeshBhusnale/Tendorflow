from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.client import Client
from app.models.dsc_key import DscKey
from app.models.dsc_key_event import DscKeyEvent
from app.models.user import User
from app.schemas.dsc_key import STATUS_EVENT_TYPES, DscKeyCreate, DscKeyUpdate

# No ownership check in this module any more (CH-19): any signed-in user may
# edit any DSC key, and the row reports whoever touched it last. Deletion is
# gated to admins at the router.

# Fields that belong to the history event, not to the key row itself.
EVENT_ONLY_FIELDS = {"issued_to", "issued_phone"}


async def _assert_client_exists(session: AsyncSession, client_id: UUID | None) -> None:
    if client_id is not None and await session.get(Client, client_id) is None:
        raise NotFoundError(code="CLIENT_NOT_FOUND", message="Client not found.")


def _eager(query):
    """See credential_service._eager — forces relationships to be re-read."""
    return query.execution_options(populate_existing=True)


async def list_dsc_keys(
    session: AsyncSession,
    page: int,
    page_size: int,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[DscKey], int]:
    query = select(DscKey)
    count_query = select(func.count()).select_from(DscKey)

    if client_id is not None:
        query = query.where(DscKey.client_id == client_id)
        count_query = count_query.where(DscKey.client_id == client_id)

    if status is not None:
        query = query.where(DscKey.key_status == status)
        count_query = count_query.where(DscKey.key_status == status)

    if search:
        pattern = f"%{search}%"
        # Storage notes are searchable because locating a key by "Drawer 3" is
        # the whole point of this module (PRD 4.5).
        matching = or_(
            Client.contact_person_name.ilike(pattern),
            Client.company_name.ilike(pattern),
            DscKey.storage_location_notes.ilike(pattern),
        )
        query = query.join(Client, DscKey.client_id == Client.id).where(matching)
        count_query = count_query.join(Client, DscKey.client_id == Client.id).where(matching)

    total_count = await session.scalar(count_query)
    query = query.order_by(DscKey.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list((await session.scalars(_eager(query))).unique().all())
    return items, total_count or 0


async def get_dsc_key(session: AsyncSession, dsc_key_id: UUID) -> DscKey:
    dsc_key = await session.scalar(_eager(select(DscKey).where(DscKey.id == dsc_key_id)))
    if dsc_key is None:
        raise NotFoundError(code="NOT_FOUND", message="DSC key not found.")
    return dsc_key


async def list_dsc_key_events(session: AsyncSession, dsc_key_id: UUID) -> list[DscKeyEvent]:
    """The full history of one key, newest first (CH-18).

    Loads the key first so an unknown id is a 404 rather than an empty list —
    "this key has no history" and "this key does not exist" are different
    answers and the UI shows them differently.
    """
    await get_dsc_key(session, dsc_key_id)
    # Ordered by the sequence, not by created_at: a key logged as already
    # issued writes both its events in one transaction, and Postgres gives every
    # row in a transaction the same now(). See migration a3e9b2c7d541.
    query = (
        select(DscKeyEvent)
        .where(DscKeyEvent.dsc_key_id == dsc_key_id)
        .order_by(DscKeyEvent.seq.desc())
    )
    return list((await session.scalars(_eager(query))).unique().all())


async def create_dsc_key(
    session: AsyncSession, current_user: User, payload: DscKeyCreate
) -> DscKey:
    await _assert_client_exists(session, payload.client_id)

    dsc_key = DscKey(**payload.model_dump(exclude=EVENT_ONLY_FIELDS), created_by=current_user.id)
    session.add(dsc_key)
    # Needed before the events below can reference dsc_key.id, and it keeps the
    # key and its opening history in one transaction: a key can never exist
    # with no record of having been created.
    await session.flush()

    session.add(
        DscKeyEvent(dsc_key_id=dsc_key.id, event_type="Created", created_by=current_user.id)
    )
    # A key logged straight into someone's hands gets both events, so the
    # history reads creation-then-issuance rather than starting mid-story.
    event_type = STATUS_EVENT_TYPES.get(payload.key_status)
    if event_type is not None:
        session.add(
            DscKeyEvent(
                dsc_key_id=dsc_key.id,
                event_type=event_type,
                issued_to=payload.issued_to,
                issued_phone=payload.issued_phone,
                created_by=current_user.id,
            )
        )

    await session.commit()
    return await get_dsc_key(session, dsc_key.id)


async def update_dsc_key(
    session: AsyncSession, current_user: User, dsc_key_id: UUID, payload: DscKeyUpdate
) -> DscKey:
    dsc_key = await get_dsc_key(session, dsc_key_id)

    data = payload.model_dump(exclude_unset=True)
    issued_to = data.pop("issued_to", None)
    issued_phone = data.pop("issued_phone", None)
    await _assert_client_exists(session, data.get("client_id"))

    new_status = data.get("key_status")
    # Re-issuing a key that is already out — to a different person — is a real
    # event even though the status does not change, so fresh issuance details
    # count as a trigger in their own right.
    should_record = new_status in STATUS_EVENT_TYPES and (
        new_status != dsc_key.key_status or issued_to is not None
    )

    for field, value in data.items():
        setattr(dsc_key, field, value)
    # Attribution follows the latest edit (CH-19).
    dsc_key.created_by = current_user.id

    if should_record:
        session.add(
            DscKeyEvent(
                dsc_key_id=dsc_key.id,
                event_type=STATUS_EVENT_TYPES[new_status],
                issued_to=issued_to,
                issued_phone=issued_phone,
                created_by=current_user.id,
            )
        )

    await session.commit()
    return await get_dsc_key(session, dsc_key_id)


async def delete_dsc_key(session: AsyncSession, dsc_key_id: UUID) -> None:
    """Admin-only, enforced by the router's require_admin dependency.

    The key's events go with it: dsc_key_events.dsc_key_id is ON DELETE CASCADE.
    """
    dsc_key = await get_dsc_key(session, dsc_key_id)
    await session.delete(dsc_key)
    await session.commit()
