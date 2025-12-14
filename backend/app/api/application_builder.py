"""
Application Builder API endpoints for super admins
Manage application sections and questions
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel
from uuid import UUID
from sqlalchemy.orm import Session, joinedload, object_session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.application import ApplicationSection, ApplicationQuestion, ApplicationHeader

router = APIRouter(prefix="/application-builder", tags=["application-builder"])


# Pydantic Models
class QuestionValidationRules(BaseModel):
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    pattern: Optional[str] = None
    file_types: Optional[List[str]] = None
    max_file_size: Optional[int] = None


class QuestionBase(BaseModel):
    question_text: str
    question_type: str
    help_text: Optional[str] = None
    description: Optional[str] = None
    placeholder: Optional[str] = None
    is_required: bool = False
    is_active: bool = True
    persist_annually: bool = False  # Keep response during annual reset
    order_index: int
    options: Optional[Union[List[str], Dict[str, Any]]] = None
    validation_rules: Optional[QuestionValidationRules] = None
    show_when_status: Optional[str] = None
    template_file_id: Optional[UUID] = None
    show_if_question_id: Optional[UUID] = None
    show_if_answer: Optional[str] = None
    detail_prompt_trigger: Optional[List[str]] = None
    detail_prompt_text: Optional[str] = None


class QuestionCreate(QuestionBase):
    section_id: UUID


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    help_text: Optional[str] = None
    description: Optional[str] = None
    placeholder: Optional[str] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    persist_annually: Optional[bool] = None
    order_index: Optional[int] = None
    options: Optional[Union[List[str], Dict[str, Any]]] = None
    validation_rules: Optional[QuestionValidationRules] = None
    show_when_status: Optional[str] = None
    template_file_id: Optional[UUID] = None
    show_if_question_id: Optional[UUID] = None
    show_if_answer: Optional[str] = None
    detail_prompt_trigger: Optional[List[str]] = None
    detail_prompt_text: Optional[str] = None


class QuestionResponse(QuestionBase):
    id: UUID
    section_id: UUID
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class SectionBase(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int
    is_active: bool = True
    show_when_status: Optional[str] = None
    required_status: Optional[str] = None  # NULL=all, 'applicant'=applicant only, 'camper'=camper only


class SectionCreate(SectionBase):
    pass


class SectionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None
    show_when_status: Optional[str] = None
    required_status: Optional[str] = None  # NULL=all, 'applicant', 'camper'


class SectionWithQuestions(SectionBase):
    id: UUID
    created_at: str
    updated_at: str
    questions: List[QuestionResponse]

    class Config:
        from_attributes = True


# Header Pydantic Models
class HeaderBase(BaseModel):
    header_text: str
    order_index: int
    is_active: bool = True


class HeaderCreate(HeaderBase):
    section_id: UUID


class HeaderUpdate(BaseModel):
    header_text: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None


class HeaderResponse(HeaderBase):
    id: UUID
    section_id: UUID
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# Helper function to check super admin
def require_super_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


def convert_header_to_response(header: ApplicationHeader) -> dict:
    """Convert SQLAlchemy header model to response dict"""
    return {
        "id": str(header.id),
        "section_id": str(header.section_id),
        "header_text": header.header_text,
        "order_index": header.order_index,
        "is_active": header.is_active,
        "created_at": header.created_at.isoformat(),
        "updated_at": header.updated_at.isoformat(),
    }


def convert_section_to_response(section: ApplicationSection) -> dict:
    """Convert SQLAlchemy section model to response dict"""
    return {
        "id": str(section.id),
        "title": section.title,
        "description": section.description,
        "order_index": section.order_index,
        "is_active": section.is_active,
        "show_when_status": section.show_when_status,
        "required_status": section.required_status,  # NULL=all, 'applicant', 'camper'
        "created_at": section.created_at.isoformat(),
        "updated_at": section.updated_at.isoformat(),
        "questions": [convert_question_to_response(q) for q in section.questions],
        "headers": [convert_header_to_response(h) for h in section.headers]
    }


def convert_question_to_response(question: ApplicationQuestion) -> dict:
    """Convert SQLAlchemy question model to response dict"""
    # Get template filename if template_file_id exists
    from app.models.application import File as FileModel

    template_filename = None
    if question.template_file_id:
        try:
            session = object_session(question)
            if session:
                template_file = session.query(FileModel).filter(FileModel.id == question.template_file_id).first()
                if template_file:
                    template_filename = template_file.file_name
        except Exception as e:
            # Log error but don't fail the response
            print(f"Error fetching template filename: {e}")

    return {
        "id": str(question.id),
        "section_id": str(question.section_id),
        "question_text": question.question_text,
        "question_type": question.question_type,
        "help_text": question.help_text,
        "description": question.description,
        "placeholder": question.placeholder,
        "is_required": question.is_required,
        "is_active": question.is_active,
        "persist_annually": question.persist_annually,
        "order_index": question.order_index,
        "options": question.options,
        "validation_rules": question.validation_rules,
        "show_when_status": question.show_when_status,
        "template_file_id": str(question.template_file_id) if question.template_file_id else None,
        "template_filename": template_filename,
        "show_if_question_id": str(question.show_if_question_id) if question.show_if_question_id else None,
        "show_if_answer": question.show_if_answer,
        "detail_prompt_trigger": question.detail_prompt_trigger,
        "detail_prompt_text": question.detail_prompt_text,
        "created_at": question.created_at.isoformat(),
        "updated_at": question.updated_at.isoformat(),
    }


# Section Endpoints
@router.get("/sections")
async def get_all_sections(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Get all application sections with their questions"""

    query = db.query(ApplicationSection).options(
        joinedload(ApplicationSection.questions)
    )

    if not include_inactive:
        query = query.filter(ApplicationSection.is_active == True)

    sections = query.order_by(ApplicationSection.order_index).all()

    return [convert_section_to_response(section) for section in sections]


@router.post("/sections")
async def create_section(
    section: SectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Create a new application section"""

    # Convert 'always' to NULL for show_when_status (database constraint)
    show_when_status_value = section.show_when_status
    if show_when_status_value == 'always':
        show_when_status_value = None

    new_section = ApplicationSection(
        title=section.title,
        description=section.description,
        order_index=section.order_index,
        is_active=section.is_active,
        show_when_status=show_when_status_value,
        required_status=section.required_status  # NULL=all, 'applicant', 'camper'
    )

    db.add(new_section)
    db.commit()
    db.refresh(new_section)

    # Load questions relationship
    db.refresh(new_section, ['questions'])

    return convert_section_to_response(new_section)


@router.put("/sections/{section_id}")
async def update_section(
    section_id: UUID,
    section: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Update an application section"""

    db_section = db.query(ApplicationSection).options(
        joinedload(ApplicationSection.questions)
    ).filter(ApplicationSection.id == section_id).first()

    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Update only provided fields
    if section.title is not None:
        db_section.title = section.title
    if section.description is not None:
        db_section.description = section.description
    if section.order_index is not None:
        db_section.order_index = section.order_index
    if section.is_active is not None:
        db_section.is_active = section.is_active
    if section.show_when_status is not None:
        # Convert 'always' to NULL for show_when_status (database constraint)
        show_when_status_value = section.show_when_status
        if show_when_status_value == 'always':
            show_when_status_value = None
        db_section.show_when_status = show_when_status_value
    if section.required_status is not None:
        db_section.required_status = section.required_status  # NULL=all, 'applicant', 'camper'

    db.commit()
    db.refresh(db_section)

    return convert_section_to_response(db_section)


@router.delete("/sections/{section_id}")
async def delete_section(
    section_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Delete an application section (and all its questions via CASCADE)"""

    db_section = db.query(ApplicationSection).filter(
        ApplicationSection.id == section_id
    ).first()

    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")

    db.delete(db_section)
    db.commit()

    return {"message": "Section deleted successfully"}


# Question Endpoints
@router.post("/questions")
async def create_question(
    question: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Create a new question in a section"""

    # Verify section exists
    section = db.query(ApplicationSection).filter(
        ApplicationSection.id == question.section_id
    ).first()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Convert validation_rules to dict if present
    validation_rules_dict = None
    if question.validation_rules:
        validation_rules_dict = question.validation_rules.dict()

    # Convert 'always' to NULL for show_when_status (database constraint)
    show_when_status_value = question.show_when_status
    if show_when_status_value == 'always':
        show_when_status_value = None

    new_question = ApplicationQuestion(
        section_id=question.section_id,
        question_text=question.question_text,
        question_type=question.question_type,
        help_text=question.help_text,
        placeholder=question.placeholder,
        is_required=question.is_required,
        is_active=question.is_active,
        persist_annually=question.persist_annually,
        order_index=question.order_index,
        options=question.options,
        validation_rules=validation_rules_dict,
        show_when_status=show_when_status_value,
        template_file_id=question.template_file_id,
        show_if_question_id=question.show_if_question_id,
        show_if_answer=question.show_if_answer,
        detail_prompt_trigger=question.detail_prompt_trigger,
        detail_prompt_text=question.detail_prompt_text
    )

    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    return convert_question_to_response(new_question)


@router.put("/questions/{question_id}")
async def update_question(
    question_id: UUID,
    question: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Update a question"""

    db_question = db.query(ApplicationQuestion).filter(
        ApplicationQuestion.id == question_id
    ).first()

    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Update only provided fields
    if question.question_text is not None:
        db_question.question_text = question.question_text
    if question.question_type is not None:
        db_question.question_type = question.question_type
    if question.help_text is not None:
        db_question.help_text = question.help_text
    if question.description is not None:
        db_question.description = question.description
    if question.placeholder is not None:
        db_question.placeholder = question.placeholder
    if question.is_required is not None:
        db_question.is_required = question.is_required
    if question.is_active is not None:
        db_question.is_active = question.is_active
    if question.persist_annually is not None:
        db_question.persist_annually = question.persist_annually
    if question.order_index is not None:
        db_question.order_index = question.order_index
    if question.options is not None:
        db_question.options = question.options
    if question.validation_rules is not None:
        db_question.validation_rules = question.validation_rules.dict()
    if question.show_when_status is not None:
        # Convert 'always' to NULL for show_when_status (database constraint)
        show_when_status_value = question.show_when_status
        if show_when_status_value == 'always':
            show_when_status_value = None
        db_question.show_when_status = show_when_status_value
    if question.template_file_id is not None:
        db_question.template_file_id = question.template_file_id
    if question.show_if_question_id is not None:
        db_question.show_if_question_id = question.show_if_question_id
    if question.show_if_answer is not None:
        db_question.show_if_answer = question.show_if_answer
    # Always update detail_prompt fields if provided (even if empty/null)
    if question.detail_prompt_trigger is not None:
        db_question.detail_prompt_trigger = question.detail_prompt_trigger if question.detail_prompt_trigger else None
    if question.detail_prompt_text is not None:
        db_question.detail_prompt_text = question.detail_prompt_text if question.detail_prompt_text else None

    db.commit()
    db.refresh(db_question)

    return convert_question_to_response(db_question)


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Delete a question"""

    db_question = db.query(ApplicationQuestion).filter(
        ApplicationQuestion.id == question_id
    ).first()

    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(db_question)
    db.commit()

    return {"message": "Question deleted successfully"}


@router.post("/questions/{question_id}/duplicate")
async def duplicate_question(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Duplicate a question - creates a copy with ' - Copy' appended to the name"""

    # Get the original question
    original_question = db.query(ApplicationQuestion).filter(
        ApplicationQuestion.id == question_id
    ).first()

    if not original_question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Shift all questions after the original down by one
    questions_to_shift = db.query(ApplicationQuestion).filter(
        ApplicationQuestion.section_id == original_question.section_id,
        ApplicationQuestion.order_index > original_question.order_index
    ).all()

    for q in questions_to_shift:
        q.order_index += 1

    # Create the duplicate
    duplicated_question = ApplicationQuestion(
        section_id=original_question.section_id,
        question_text=f"{original_question.question_text} - Copy",
        question_type=original_question.question_type,
        help_text=original_question.help_text,
        placeholder=original_question.placeholder,
        is_required=original_question.is_required,
        is_active=original_question.is_active,
        persist_annually=original_question.persist_annually,
        order_index=original_question.order_index + 1,  # Place right after original
        options=original_question.options,
        validation_rules=original_question.validation_rules,
        show_when_status=original_question.show_when_status,
        template_file_id=original_question.template_file_id,
        show_if_question_id=original_question.show_if_question_id,
        show_if_answer=original_question.show_if_answer,
        detail_prompt_trigger=original_question.detail_prompt_trigger,
        detail_prompt_text=original_question.detail_prompt_text
    )

    db.add(duplicated_question)
    db.commit()
    db.refresh(duplicated_question)

    return convert_question_to_response(duplicated_question)


@router.post("/sections/reorder")
async def reorder_sections(
    section_ids: List[UUID],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Reorder sections by providing ordered list of section IDs"""

    # Update order_index for each section
    for index, section_id in enumerate(section_ids):
        db.query(ApplicationSection).filter(
            ApplicationSection.id == section_id
        ).update({"order_index": index})

    db.commit()

    return {"message": "Sections reordered successfully"}


@router.post("/questions/reorder")
async def reorder_questions(
    question_ids: List[UUID],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Reorder questions within a section by providing ordered list of question IDs"""

    # Update order_index for each question
    for index, question_id in enumerate(question_ids):
        db.query(ApplicationQuestion).filter(
            ApplicationQuestion.id == question_id
        ).update({"order_index": index})

    db.commit()

    return {"message": "Questions reordered successfully"}


# Header Endpoints
@router.post("/headers")
async def create_header(
    header: HeaderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Create a new header in a section"""

    # Verify section exists
    section = db.query(ApplicationSection).filter(
        ApplicationSection.id == header.section_id
    ).first()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    db_header = ApplicationHeader(
        section_id=header.section_id,
        header_text=header.header_text,
        order_index=header.order_index,
        is_active=header.is_active
    )

    db.add(db_header)
    db.commit()
    db.refresh(db_header)

    return convert_header_to_response(db_header)


@router.put("/headers/{header_id}")
async def update_header(
    header_id: UUID,
    header: HeaderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Update an existing header"""

    db_header = db.query(ApplicationHeader).filter(
        ApplicationHeader.id == header_id
    ).first()

    if not db_header:
        raise HTTPException(status_code=404, detail="Header not found")

    # Update fields that are provided
    if header.header_text is not None:
        db_header.header_text = header.header_text
    if header.order_index is not None:
        db_header.order_index = header.order_index
    if header.is_active is not None:
        db_header.is_active = header.is_active

    db.commit()
    db.refresh(db_header)

    return convert_header_to_response(db_header)


@router.delete("/headers/{header_id}")
async def delete_header(
    header_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Delete a header"""

    db_header = db.query(ApplicationHeader).filter(
        ApplicationHeader.id == header_id
    ).first()

    if not db_header:
        raise HTTPException(status_code=404, detail="Header not found")

    db.delete(db_header)
    db.commit()

    return {"message": "Header deleted successfully"}


@router.post("/headers/reorder")
async def reorder_headers(
    header_ids: List[UUID],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    """Reorder headers within a section by providing ordered list of header IDs"""

    # Update order_index for each header
    for index, header_id in enumerate(header_ids):
        db.query(ApplicationHeader).filter(
            ApplicationHeader.id == header_id
        ).update({"order_index": index})

    db.commit()

    return {"message": "Headers reordered successfully"}
