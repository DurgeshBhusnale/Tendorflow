from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.client import CreatorRef

if TYPE_CHECKING:
    from app.models.credential import Credential

MASKED_PASSWORD = "•" * 6


class ClientRef(BaseModel):
    """The client as it appears nested in another resource.

    Carries the contact person as well as the company because every table that
    embeds a client now shows both, and both are searchable (CH-07).
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contact_person_name: str
    company_name: str


class PortalRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class CredentialCreate(BaseModel):
    client_id: UUID
    portal_id: UUID
    login_identifier: str | None = Field(default=None, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class CredentialUpdate(BaseModel):
    client_id: UUID | None = None
    portal_id: UUID | None = None
    login_identifier: str | None = Field(default=None, max_length=200)
    password: str | None = Field(default=None, min_length=1, max_length=200)


class CredentialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client: ClientRef
    portal: PortalRef
    login_identifier: str | None
    password: str
    # Last editor, not original author — see the note on ClientRead (CH-13).
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
    updated_at: datetime


def serialize_credential(credential: "Credential", *, reveal: bool = False) -> CredentialRead:
    """Serialize a credential, masking the password unless explicitly revealed.

    Masking lives here rather than in the router so that no endpoint can return
    a credential without going through this decision. Only the single-row
    `GET /api/credentials/:id?reveal=true` passes reveal=True.
    """
    model = CredentialRead.model_validate(credential)
    if not reveal:
        model.password = MASKED_PASSWORD
    return model
