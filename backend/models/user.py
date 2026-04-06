from sqlalchemy import Column, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from db import Base


class User(Base):
    """
    Defines the User ORM model mapped to the 'users' table.

    Stores basic user profile data (email, name, avatar, currency) and uses a UUID
    primary key, typically synced with an external auth system.

    Includes automatic timestamps for creation and updates.
    """
    __tablename__= "users"
    
    id= Column(UUID(as_uuid=True), primary_key=True, index=True)
    email= Column(String, unique=True, index=True, nullable=False)
    display_name= Column(String(100))
    avatar_url= Column(Text)
    home_currency= Column(String(3), nullable=False, default="USD")
    created_at= Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at= Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)