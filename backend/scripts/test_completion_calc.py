#!/usr/bin/env python3
"""
Test script to verify calculate_completion_percentage works correctly for campers
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.applications import calculate_completion_percentage
from app.models.application import Application, ApplicationSection, ApplicationQuestion, ApplicationResponse

def test_camper_completion():
    """Test the completion calculation for a camper application"""
    db = next(get_db())

    # Get the camper application
    app = db.query(Application).filter(
        Application.status == 'camper'
    ).first()

    if not app:
        print("No camper application found!")
        return

    print(f"\n{'='*60}")
    print(f"Testing application: {app.camper_first_name} {app.camper_last_name}")
    print(f"ID: {app.id}")
    print(f"Status: {app.status}, Sub-status: {app.sub_status}")
    print(f"Current stored completion: {app.completion_percentage}%")
    print(f"{'='*60}\n")

    # Get all sections that should be visible to campers
    sections = db.query(ApplicationSection).filter(
        ApplicationSection.is_active == True
    ).order_by(ApplicationSection.order_index).all()

    print(f"Total sections visible to campers: {len(sections)}")
    print("\nSections breakdown:")
    print("-" * 60)

    # Get all responses for this application
    responses = db.query(ApplicationResponse).filter(
        ApplicationResponse.application_id == str(app.id)
    ).all()
    response_dict = {str(r.question_id): r.response_value for r in responses}
    file_dict = {str(r.question_id): r.file_id for r in responses if r.file_id}

    print(f"Total responses: {len(responses)}")
    print(f"Responses with files: {len(file_dict)}")

    sections_with_requirements = 0
    completed_sections = 0

    for section in sections:
        # Get all active questions for this section
        questions = db.query(ApplicationQuestion).filter(
            ApplicationQuestion.section_id == section.id,
            ApplicationQuestion.is_active == True
        ).all()

        required_questions = [q for q in questions if q.is_required]

        if not required_questions:
            print(f"  {section.order_index}. {section.title}: No required questions (skipped)")
            continue

        sections_with_requirements += 1

        answered = 0
        for q in required_questions:
            qid = str(q.id)
            if qid in file_dict:
                answered += 1
            elif qid in response_dict and response_dict[qid]:
                # Check if not empty
                val = response_dict[qid]
                if val and val not in ['null', '[]', '{}', '']:
                    answered += 1

        is_complete = answered == len(required_questions)
        if is_complete:
            completed_sections += 1

        status = "✅" if is_complete else "❌"
        print(f"  {section.order_index}. {section.title} (req_status={section.required_status}): {answered}/{len(required_questions)} required answered {status}")

    print("-" * 60)
    print(f"\nSections with requirements: {sections_with_requirements}")
    print(f"Completed sections: {completed_sections}")

    expected_percentage = int((completed_sections / sections_with_requirements) * 100) if sections_with_requirements > 0 else 100
    print(f"\nExpected completion: {expected_percentage}%")

    # Now call the actual function
    actual_percentage = calculate_completion_percentage(db, str(app.id))
    print(f"Calculated by function: {actual_percentage}%")

    if actual_percentage != expected_percentage:
        print(f"\n⚠️ MISMATCH: Expected {expected_percentage}% but got {actual_percentage}%")
    else:
        print(f"\n✅ MATCH: Calculation is correct!")

    db.close()

if __name__ == "__main__":
    test_camper_completion()
