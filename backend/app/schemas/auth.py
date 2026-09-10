from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    # Username, not email (CH-02). Deliberately unvalidated beyond being a
    # string: a login endpoint that rejects a malformed username with a
    # different error than a wrong one leaks which accounts exist.
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    username: str
    email: str
    role: str


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    username: str
    email: str
    role: str
    is_active: bool
