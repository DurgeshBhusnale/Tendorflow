from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.client import Client
from app.models.credential import Credential
from app.models.portal import Portal
from app.models.user import User
from app.schemas.credential import CredentialCreate, CredentialUpdate

# No ownership check here any more (CH-19): any signed-in user may edit any
# credential, and the row reports whoever touched it last. Deletion is gated to
# admins at the router.


async def _assert_refs_exist(
    session: AsyncSession, client_id: UUID | None, portal_id: UUID | None
) -> None:
    if client_id is not None and await session.get(Client, client_id) is None:
        raise NotFoundError(code="CLIENT_NOT_FOUND", message="Client not found.")
    if portal_id is not None and await session.get(Portal, portal_id) is None:
        raise NotFoundError(code="PORTAL_NOT_FOUND", message="Portal not found.")


async def list_credentials(
    session: AsyncSession,
    page: int,
    page_size: int,
    client_id: UUID | None = None,
    portal_id: UUID | None = None,
    search: str | None = None,
) -> tuple[list[Credential], int]:
    query = select(Credential)
    count_query = select(func.count()).select_from(Credential)

    if client_id is not None:
        query = query.where(Credential.client_id == client_id)
        count_query = count_query.where(Credential.client_id == client_id)

    if portal_id is not None:
        query = query.where(Credential.portal_id == portal_id)
        count_query = count_query.where(Credential.portal_id == portal_id)

    if search:
        pattern = f"%{search}%"
        matching = or_(
            Client.contact_person_name.ilike(pattern),
            Client.company_name.ilike(pattern),
            Portal.name.ilike(pattern),
        )
        query = query.join(Client, Credential.client_id == Client.id).join(
            Portal, Credential.portal_id == Portal.id
        )
        count_query = count_query.join(Client, Credential.client_id == Client.id).join(
            Portal, Credential.portal_id == Portal.id
        )
        query = query.where(matching)
        count_query = count_query.where(matching)

    total_count = await session.scalar(count_query)
    query = (
        query.order_by(Credential.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = list((await session.scalars(_eager(query))).unique().all())
    return items, total_count or 0


def _eager(query):
    """Force the client/portal/creator relationships to load.

    `populate_existing` matters because a row written earlier in the same
    session sits in the identity map with its relationships unloaded; without
    it the eager loaders are skipped and serialization raises MissingGreenlet
    trying to lazy-load them.
    """
    return query.execution_options(populate_existing=True)


async def get_credential(session: AsyncSession, credential_id: UUID) -> Credential:
    credential = await session.scalar(
        _eager(select(Credential).where(Credential.id == credential_id))
    )
    if credential is None:
        raise NotFoundError(code="NOT_FOUND", message="Credential not found.")
    return credential


async def create_credential(
    session: AsyncSession, current_user: User, payload: CredentialCreate
) -> Credential:
    await _assert_refs_exist(session, payload.client_id, payload.portal_id)

    credential = Credential(**payload.model_dump(), created_by=current_user.id)
    session.add(credential)
    await session.commit()
    return await get_credential(session, credential.id)


async def update_credential(
    session: AsyncSession,
    current_user: User,
    credential_id: UUID,
    payload: CredentialUpdate,
) -> Credential:
    credential = await get_credential(session, credential_id)

    data = payload.model_dump(exclude_unset=True)
    await _assert_refs_exist(session, data.get("client_id"), data.get("portal_id"))

    for field, value in data.items():
        setattr(credential, field, value)

    # Attribution follows the latest edit (CH-13): the table's "Added/Updated
    # By" column and its date have to name whoever last changed the password,
    # not whoever first stored it. `updated_at` comes from the table trigger.
    credential.created_by = current_user.id

    await session.commit()
    return await get_credential(session, credential_id)


async def delete_credential(session: AsyncSession, credential_id: UUID) -> None:
    """Admin-only — enforced by the router's require_admin dependency."""
    credential = await get_credential(session, credential_id)
    await session.delete(credential)
    await session.commit()
