"""
Application Pydantic schemas
"""

from typing import Optional, List, Any, Dict, Union
from datetime import datetime
from pydantic import BaseModel, UUID4


# Application Section Schemas
class ApplicationSectionBase(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int
    is_active: bool = True
    visible_before_acceptance: bool = True
    show_when_status: Optional[str] = None
    required_status: Optional[str] = None  # NULL=all, 'applicant'=applicant only, 'camper'=camper only


class ApplicationSection(ApplicationSectionBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Application Question Schemas
class ApplicationQuestionBase(BaseModel):
    section_id: UUID4
    question_text: str
    question_type: str  # text, textarea, dropdown, multiple_choice, file_upload, checkbox, date, email, phone, signature
    options: Optional[Any] = None  # Can be array or dict
    is_required: bool = False
    reset_annually: bool = False  # Legacy field
    persist_annually: bool = False  # Keep response during annual reset
    order_index: int
    validation_rules: Optional[Any] = None  # Can be array or dict
    help_text: Optional[str] = None
    description: Optional[str] = None  # Long-form markdown description
    placeholder: Optional[str] = None
    is_active: bool = True
    show_when_status: Optional[str] = None
    # Conditional logic fields
    show_if_question_id: Optional[UUID4] = None
    show_if_answer: Optional[str] = None
    # Detail prompt fields
    detail_prompt_trigger: Optional[Any] = None  # Can be string or array
    detail_prompt_text: Optional[str] = None
    # Template file field
    template_file_id: Optional[UUID4] = None


class ApplicationQuestion(ApplicationQuestionBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationSectionWithQuestions(ApplicationSection):
    """Section with its questions included"""
    questions: List[ApplicationQuestion] = []

    class Config:
        from_attributes = True


# Application Response Schemas
class ApplicationResponseBase(BaseModel):
    question_id: UUID4
    response_value: Optional[str] = None
    file_id: Optional[UUID4] = None


class ApplicationResponseCreate(ApplicationResponseBase):
    pass


class ApplicationResponse(ApplicationResponseBase):
    id: UUID4
    application_id: UUID4
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Application Schemas
class ApplicationBase(BaseModel):
    camper_first_name: Optional[str] = None
    camper_last_name: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    camper_first_name: Optional[str] = None
    camper_last_name: Optional[str] = None
    responses: Optional[List[ApplicationResponseCreate]] = None


class Application(ApplicationBase):
    id: UUID4
    user_id: UUID4
    status: str  # applicant, camper, inactive
    sub_status: str  # not_started, incomplete, completed, under_review, waitlist, complete, deferred, withdrawn, rejected
    completion_percentage: int
    is_returning_camper: bool
    cabin_assignment: Optional[str] = None
    # Payment tracking
    paid_invoice: Optional[bool] = None  # NULL=no invoice, False=unpaid, True=paid
    stripe_invoice_id: Optional[str] = None
    # Camper metadata
    camper_age: Optional[int] = None
    camper_gender: Optional[str] = None
    tuition_status: Optional[str] = None
    # Profile photo URL (pre-signed URL for displaying camper photo)
    profile_photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Status timestamps
    completed_at: Optional[datetime] = None  # When applicant reached 100%
    under_review_at: Optional[datetime] = None  # When first admin action received
    promoted_to_camper_at: Optional[datetime] = None  # When promoted to camper status
    waitlisted_at: Optional[datetime] = None  # When moved to waitlist
    deferred_at: Optional[datetime] = None  # When deferred
    withdrawn_at: Optional[datetime] = None  # When withdrawn
    rejected_at: Optional[datetime] = None  # When rejected
    paid_at: Optional[datetime] = None  # When payment received

    class Config:
        from_attributes = True


class ApplicationWithResponses(Application):
    """Application with all responses"""
    responses: List[ApplicationResponse] = []

    class Config:
        from_attributes = True


class UserInfo(BaseModel):
    """Basic user info for admin views"""
    id: UUID4
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class ApplicationWithUser(ApplicationWithResponses):
    """Application with responses and user info (admin view)"""
    user: Optional[UserInfo] = None

    class Config:
        from_attributes = True


# Progress tracking
class SectionProgress(BaseModel):
    """Progress for a single section"""
    section_id: UUID4
    section_title: str
    total_questions: int
    required_questions: int
    answered_questions: int
    answered_required: int
    completion_percentage: int
    is_complete: bool


class ApplicationProgress(BaseModel):
    """Overall application progress"""
    application_id: UUID4
    total_sections: int
    completed_sections: int
    overall_percentage: int
    section_progress: List[SectionProgress]


# File schemas
class FileBase(BaseModel):
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    section: Optional[str] = None


class FileUpload(FileBase):
    pass


class FileResponse(FileBase):
    id: UUID4
    application_id: UUID4
    storage_path: str
    created_at: datetime

    class Config:
        from_attributes = True
