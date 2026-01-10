"""
Application-related database models
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, DECIMAL, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ApplicationSection(Base):
    """Application section model - defines sections of the application form"""

    __tablename__ = "application_sections"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    order_index = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, server_default="true")
    visible_before_acceptance = Column(Boolean, default=True, server_default="true")
    required_status = Column(String(50), nullable=True)  # NULL=all, 'applicant'=applicant only, 'camper'=camper only
    score_calculation_type = Column(String(50), nullable=True)  # e.g., 'fasd_best' for FASD BeST score calculation
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    questions = relationship("ApplicationQuestion", back_populates="section", order_by="ApplicationQuestion.order_index")
    headers = relationship("ApplicationHeader", back_populates="section", order_by="ApplicationHeader.order_index")

    def __repr__(self):
        return f"<ApplicationSection {self.title}>"


class ApplicationHeader(Base):
    """Application header model - standalone header cards for grouping questions"""

    __tablename__ = "application_headers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("application_sections.id", ondelete="CASCADE"))
    header_text = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationship
    section = relationship("ApplicationSection", back_populates="headers")

    def __repr__(self):
        return f"<ApplicationHeader {self.header_text}>"


class ApplicationQuestion(Base):
    """Application question model - defines individual questions"""

    __tablename__ = "application_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    section_id = Column(UUID(as_uuid=True), ForeignKey("application_sections.id", ondelete="CASCADE"))
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)  # text, textarea, dropdown, etc.
    options = Column(JSONB)  # For dropdown/multiple choice options
    is_required = Column(Boolean, default=False, server_default="false")
    reset_annually = Column(Boolean, default=False, server_default="false")  # Legacy field
    persist_annually = Column(Boolean, default=False, server_default="false")  # Keep response during annual reset
    order_index = Column(Integer, nullable=False)
    validation_rules = Column(JSONB)
    help_text = Column(Text)
    description = Column(Text)  # Long-form markdown description displayed above question
    placeholder = Column(Text)
    is_active = Column(Boolean, default=True, server_default="true")
    template_file_id = Column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)  # Optional template file to download
    show_if_question_id = Column(UUID(as_uuid=True), ForeignKey("application_questions.id", ondelete="CASCADE"), nullable=True)  # Show only if this question has specific answer
    show_if_answer = Column(Text, nullable=True)  # The answer value that triggers showing this question
    detail_prompt_trigger = Column(JSONB, nullable=True)  # Array of answers that trigger showing detail prompt
    detail_prompt_text = Column(Text, nullable=True)  # Text for the detail prompt textarea
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    section = relationship("ApplicationSection", back_populates="questions")
    responses = relationship("ApplicationResponse", back_populates="question")

    def __repr__(self):
        return f"<ApplicationQuestion {self.question_text[:50]}>"


class Application(Base):
    """User's application instance"""

    __tablename__ = "applications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    camper_first_name = Column(String(100))
    camper_last_name = Column(String(100))
    status = Column(String(50), default="applicant", server_default="applicant")  # applicant, camper, inactive
    sub_status = Column(String(50), default="not_started", server_default="not_started")  # Progress within status
    completion_percentage = Column(Integer, default=0, server_default="0")
    is_returning_camper = Column(Boolean, default=False, server_default="false")
    cabin_assignment = Column(String(50))
    application_data = Column(JSONB, default={}, server_default=text("'{}'::jsonb"))

    # Payment tracking
    paid_invoice = Column(Boolean, nullable=True)  # NULL=no invoice, False=unpaid, True=paid
    stripe_invoice_id = Column(String(255), nullable=True)  # Stripe invoice ID
    stripe_customer_id = Column(String(255), nullable=True)  # Stripe customer ID (cached from user)

    # Camper metadata for admin table
    camper_age = Column(Integer, nullable=True)
    camper_gender = Column(String(50), nullable=True)
    tuition_status = Column(String(50), nullable=True)

    # FASD BeST Score - auto-calculated from FASD Screener responses
    # NULL if not all questions answered, otherwise sum of scores
    fasd_best_score = Column(Integer, nullable=True)

    # Note: Team approvals are tracked in application_approvals table, not here

    # Legacy WordPress migration fields
    legacy_wp_camper_id = Column(Integer, nullable=True, index=True)  # WordPress camper post ID from migration

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))
    completed_at = Column(DateTime(timezone=True))  # When applicant reached 100%
    under_review_at = Column(DateTime(timezone=True))  # When first admin action received
    promoted_to_camper_at = Column(DateTime(timezone=True))  # When promoted to camper status
    waitlisted_at = Column(DateTime(timezone=True))  # When moved to waitlist
    deferred_at = Column(DateTime(timezone=True))  # When deferred
    withdrawn_at = Column(DateTime(timezone=True))  # When withdrawn
    rejected_at = Column(DateTime(timezone=True))  # When rejected
    deactivated_at = Column(DateTime(timezone=True))  # When deactivated (generic inactive)
    reactivated_at = Column(DateTime(timezone=True))  # When reactivated by user
    paid_at = Column(DateTime(timezone=True))  # When payment received
    accepted_at = Column(DateTime(timezone=True))  # Legacy - kept for migration
    declined_at = Column(DateTime(timezone=True))  # Legacy - kept for migration

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    responses = relationship("ApplicationResponse", back_populates="application", cascade="all, delete-orphan")
    files = relationship("File", back_populates="application", cascade="all, delete-orphan")
    notes = relationship("AdminNote", back_populates="application", cascade="all, delete-orphan")
    approvals = relationship("ApplicationApproval", back_populates="application", cascade="all, delete-orphan")
    medications = relationship("Medication", foreign_keys="[Medication.application_id]", cascade="all, delete-orphan")
    allergies = relationship("Allergy", foreign_keys="[Allergy.application_id]", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Application {self.camper_first_name} {self.camper_last_name} - {self.status}>"


class ApplicationResponse(Base):
    """User's response to a specific question"""

    __tablename__ = "application_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"))
    question_id = Column(UUID(as_uuid=True), ForeignKey("application_questions.id", ondelete="CASCADE"))
    response_value = Column(Text)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    application = relationship("Application", back_populates="responses")
    question = relationship("ApplicationQuestion", back_populates="responses")

    def __repr__(self):
        return f"<ApplicationResponse for question {self.question_id}>"


class File(Base):
    """Uploaded files"""

    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"))
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100))
    file_size = Column(Integer)
    storage_path = Column(String(500), nullable=False)
    section = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

    # Relationships
    application = relationship("Application", back_populates="files")

    def __repr__(self):
        return f"<File {self.file_name}>"


class AdminNote(Base):
    """Admin notes on applications"""

    __tablename__ = "admin_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"))
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    application = relationship("Application", back_populates="notes")
    admin = relationship("User", foreign_keys=[admin_id])

    def __repr__(self):
        return f"<AdminNote on application {self.application_id}>"


class ApplicationApproval(Base):
    """Admin approvals/declines for applications"""

    __tablename__ = "application_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved = Column(Boolean, nullable=False)  # True = approve, False = decline
    note = Column(Text, nullable=True)  # Required note explaining the decision
    admin_name = Column(String(255), nullable=True)  # Denormalized admin name for history
    admin_team = Column(String(50), nullable=True)  # ops, behavioral, med, lit
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

    # Relationships
    application = relationship("Application", back_populates="approvals")
    admin = relationship("User", foreign_keys=[admin_id])

    def __repr__(self):
        return f"<ApplicationApproval {'approved' if self.approved else 'declined'} by {self.admin_id}>"


class Medication(Base):
    """Camper medication tracking"""

    __tablename__ = "medications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("application_questions.id", ondelete="CASCADE"), nullable=False)
    medication_name = Column(Text, nullable=False)
    strength = Column(Text)
    dose_amount = Column(Text)
    dose_form = Column(Text)
    order_index = Column(Integer, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    application = relationship("Application", foreign_keys=[application_id], overlaps="medications")
    question = relationship("ApplicationQuestion", foreign_keys=[question_id])
    doses = relationship("MedicationDose", back_populates="medication", cascade="all, delete-orphan", order_by="MedicationDose.order_index")

    def __repr__(self):
        return f"<Medication {self.medication_name}>"


class MedicationDose(Base):
    """Dose schedule for a medication"""

    __tablename__ = "medication_doses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    medication_id = Column(UUID(as_uuid=True), ForeignKey("medications.id", ondelete="CASCADE"), nullable=False)
    given_type = Column(Text, nullable=False)  # 'At specific time' or 'As needed'
    time = Column(Text)  # Specific time or 'N/A'
    notes = Column(Text)
    order_index = Column(Integer, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    medication = relationship("Medication", back_populates="doses")

    def __repr__(self):
        return f"<MedicationDose {self.given_type} - {self.time}>"


class Allergy(Base):
    """Camper allergy tracking"""

    __tablename__ = "allergies"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("application_questions.id", ondelete="CASCADE"), nullable=False)
    allergen = Column(Text, nullable=False)
    reaction = Column(Text)
    severity = Column(Text)  # 'Mild', 'Moderate', 'Severe'
    notes = Column(Text)
    order_index = Column(Integer, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    application = relationship("Application", foreign_keys=[application_id], overlaps="allergies")
    question = relationship("ApplicationQuestion", foreign_keys=[question_id])

    def __repr__(self):
        return f"<Allergy {self.allergen}>"


class Invoice(Base):
    """Invoice for payment tracking"""

    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"))
    stripe_invoice_id = Column(String(255), unique=True, nullable=True)
    amount = Column(DECIMAL(10, 2), nullable=False)
    discount_amount = Column(DECIMAL(10, 2), default=0, server_default="0")
    scholarship_applied = Column(Boolean, default=False, server_default="false")
    scholarship_note = Column(Text, nullable=True)
    status = Column(String(50), default="draft", server_default="draft")  # draft, open, paid, void, uncollectible
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Payment plan fields
    payment_number = Column(Integer, default=1, server_default="1")
    total_payments = Column(Integer, default=1, server_default="1")
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Stripe URLs
    stripe_invoice_url = Column(Text, nullable=True)
    stripe_hosted_url = Column(Text, nullable=True)

    # Void tracking
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_reason = Column(Text, nullable=True)

    # Metadata
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    application = relationship("Application", foreign_keys=[application_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Invoice {self.id} - ${self.amount} - {self.status}>"
