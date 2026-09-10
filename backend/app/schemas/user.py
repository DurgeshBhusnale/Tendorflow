import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.schemas.validators import normalize_username

UserRole = Literal["admin", "employee"]


def validate_password_policy(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("Password must contain at least one letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")
    return password


class UserCreate(BaseModel):
    full_name: str
    # Both required at onboarding (CH-02): username is the credential, email is
    # the contact address.
    username: str
    email: EmailStr
    password: str
    role: UserRole = "employee"

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return normalize_username(v)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_policy(v)


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = None
    # Username is intentionally absent: it is the login credential, and letting
    # it change silently would strand the person holding it.

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return validate_password_policy(v)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
