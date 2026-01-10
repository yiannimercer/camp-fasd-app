#!/usr/bin/env python3
"""
Test to verify calculate_completion_percentage works correctly for both applicants and campers
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.applications import calculate_completion_percentage
from app.models.application import Application

def test_calculations():
    db = next(get_db())

    # Test the 100% applicant
    applicant_app = db.query(Application).filter(
        Application.id == '1d6f62b7-9e00-47eb-b7ba-cfbffcaefd5c'
    ).first()

    if applicant_app:
        print("=" * 60)
        print("100% APPLICANT APPLICATION")
        print(f"Name: {applicant_app.camper_first_name} {applicant_app.camper_last_name}")
        print(f"Status: {applicant_app.status}, Sub-status: {applicant_app.sub_status}")
        print(f"Stored completion: {applicant_app.completion_percentage}%")

        calculated = calculate_completion_percentage(db, str(applicant_app.id))
        print(f"Calculated completion: {calculated}%")

        if calculated == 100:
            print("✅ Applicant calculation correct!")
        else:
            print(f"⚠️ Applicant expected 100%, got {calculated}%")

    # Test the camper
    camper_app = db.query(Application).filter(
        Application.id == 'cf911573-0d9a-4f79-bd6f-72dcbcafca02'
    ).first()

    if camper_app:
        print("\n" + "=" * 60)
        print("CAMPER APPLICATION (promoted from test)")
        print(f"Name: {camper_app.camper_first_name} {camper_app.camper_last_name}")
        print(f"Status: {camper_app.status}, Sub-status: {camper_app.sub_status}")
        print(f"Stored completion: {camper_app.completion_percentage}%")

        calculated = calculate_completion_percentage(db, str(camper_app.id))
        print(f"Calculated completion: {calculated}%")

        # For camper: 4 complete sections out of 16 with requirements = 25%
        # Wait, let me count: FASD (54/54), Authorizations (1/1), Emergency Contact (3/3), Auth Release (2/2), Add'l Camper Info (0/0)
        # That's 5 complete, but Add'l Camper Info has 0 required so doesn't count
        # So 4 complete out of 16 sections with requirements = 25%
        print(f"Expected around 25% (4 complete sections out of 16 with requirements)")

    db.close()

if __name__ == "__main__":
    test_calculations()
