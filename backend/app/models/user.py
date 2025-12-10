"""
User database model
"""

from sqlalchemy import Column, String, Boolean, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class User(Base):
    """User model for authentication and authorization"""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OAuth users
    role = Column(String(20), nullable=False, server_default="user")  # user, admin, super_admin
    team = Column(String(20), nullable=True)  # For admins: ops, behavioral, med, lit
    google_id = Column(String(255), unique=True, nullable=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))
    last_login = Column(DateTime(timezone=True), nullable=True)
    email_verified = Column(Boolean, default=False, server_default="false")

    # Account status fields
    status = Column(String(20), server_default="active")  # active, inactive, suspended
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspended_by = Column(UUID(as_uuid=True), nullable=True)  # References users.id
    suspension_reason = Column(String, nullable=True)

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"