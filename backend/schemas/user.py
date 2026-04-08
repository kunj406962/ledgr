from uuid import UUID

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """Returned by GET /auth/me"""

    id: UUID
    email: str
    display_name: str | None
    avatar_url: str | None
    home_currency: str

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    """Body for PATCH /auth/me"""

    display_name: str | None = Field(default=None, max_length=100)
    home_currency: str | None = Field(default=None, min_length=3, max_length=3)
