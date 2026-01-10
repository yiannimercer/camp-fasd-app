"""
User database model
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, text
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
    supabase_auth_id = Column(UUID(as_uuid=True), unique=True, nullable=True, index=True)  # Links to Supabase auth.users
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

    # Email preferences
    receive_emails = Column(Boolean, default=True, server_default="true")  # Opt-out of automated emails

    # Email deliverability confirmation (user confirmed they receive our emails, not in spam)
    email_deliverability_confirmed = Column(Boolean, default=False, server_default="false")
    email_test_sent_at = Column(DateTime(timezone=True), nullable=True)
    email_deliverability_confirmed_at = Column(DateTime(timezone=True), nullable=True)

    # Stripe integration
    stripe_customer_id = Column(String(255), unique=True, nullable=True, index=True)

    # Legacy WordPress migration fields
    legacy_wp_user_id = Column(Integer, nullable=True, index=True)  # WordPress user ID from migration
    needs_password_setup = Column(Boolean, default=False, server_default="false")  # True for migrated users who need to set password

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
