"""
Super Admin related database models
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class SystemConfiguration(Base):
    """System configuration model - stores configurable settings"""

    __tablename__ = "system_configuration"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSONB, nullable=False)
    description = Column(Text)
    data_type = Column(String(20), nullable=False)  # 'string', 'number', 'boolean', 'date', 'json'
    category = Column(String(50), default='general')  # 'camp', 'workflow', 'files', 'email', 'contact'
    is_public = Column(Boolean, default=False)  # Can non-admins see this setting?
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationship
    updater = relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        return f"<SystemConfiguration {self.key}={self.value}>"


class AuditLog(Base):
    """Audit log model - tracks all system actions"""

    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), index=True)
    action = Column(String(50), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    details = Column(JSONB)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"), index=True)

    # Relationship
    actor = relationship("User", foreign_keys=[actor_id])

    def __repr__(self):
        return f"<AuditLog {self.entity_type}.{self.action} by {self.actor_id}>"


class EmailTemplate(Base):
    """Email template model - stores email templates with variable support"""

    __tablename__ = "email_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    key = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    html_content = Column(Text, nullable=False)
    text_content = Column(Text)
    # Markdown support - when use_markdown is True, markdown_content is converted to HTML
    markdown_content = Column(Text)  # Raw markdown source
    use_markdown = Column(Boolean, default=False)  # Use markdown instead of html_content
    trigger_event = Column(String(100), index=True)  # Event that triggers this email (e.g., 'application_created')
    variables = Column(JSONB)  # Array of available variables
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationship
    updater = relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        return f"<EmailTemplate {self.key}: {self.name}>"


class EmailAutomation(Base):
    """Email automation model - defines when/to whom emails are sent"""

    __tablename__ = "email_automations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    template_key = Column(String(100), ForeignKey("email_templates.key", ondelete="CASCADE"), nullable=False, index=True)
    trigger_type = Column(String(50), nullable=False)  # 'event' or 'scheduled'
    trigger_event = Column(String(100), index=True)  # For event-based: application_created, etc.
    schedule_day = Column(Integer)  # 0-6 for Sunday-Saturday
    schedule_hour = Column(Integer)  # 0-23
    audience_filter = Column(JSONB, default={})  # Filter criteria for recipients
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    template = relationship("EmailTemplate", foreign_keys=[template_key], primaryjoin="EmailAutomation.template_key == EmailTemplate.key")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

    def __repr__(self):
        return f"<EmailAutomation {self.name}: {self.trigger_type}/{self.trigger_event}>"


class Team(Base):
    """Team model - configurable teams for admin workflow"""

    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    key = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    color = Column(String(7), default='#3B82F6')  # Hex color
    is_active = Column(Boolean, default=True, index=True)
    order_index = Column(Integer, default=0, index=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

    def __repr__(self):
        return f"<Team {self.key}: {self.name}>"


class EmailDocument(Base):
    """
    Email document model - stores documents that can be linked in email templates.

    Documents are uploaded to Supabase Storage and can be referenced in email
    content using markdown syntax: [Document Name](signed-url)

    Use cases:
    - Forms (Medical Release, Photo Consent, etc.)
    - Information packets
    - PDFs, images, and other attachments
    """

    __tablename__ = "email_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    name = Column(String(255), nullable=False)  # Display name (e.g., "Medical Release Form")
    description = Column(Text)  # Optional description
    file_name = Column(String(255), nullable=False)  # Original filename
    storage_path = Column(String(500), nullable=False)  # Path in Supabase Storage
    file_size = Column(Integer, nullable=False)  # Size in bytes
    file_type = Column(String(100), nullable=False)  # MIME type
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

    # Relationship
    uploader = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self):
        return f"<EmailDocument {self.name}: {self.file_name}>"
