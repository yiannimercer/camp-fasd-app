#!/usr/bin/env python3
"""
WordPress to Supabase Data Migration Script

This script migrates legacy WordPress user and camper data into the new
Supabase-backed application. It handles:
1. Creating users in Supabase Auth (no password, email confirmed)
2. Creating user records in our users table
3. Creating application records with status=inactive, sub_status=deactivated
4. Creating application_responses for persist_annually fields
5. Uploading persist_annually documents to Supabase Storage

Usage:
    # Test migration (uses test data files)
    python scripts/migrate_wordpress_data.py --test --dry-run
    python scripts/migrate_wordpress_data.py --test

    # Production migration (uses real data files)
    python scripts/migrate_wordpress_data.py --dry-run
    python scripts/migrate_wordpress_data.py

Environment:
    Requires backend/.env to be configured with:
    - DATABASE_URL
    - SUPABASE_URL
    - SUPABASE_KEY (service_role key)
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from uuid import uuid4
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from supabase import create_client, Client

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
ADMIN_EMAILS_TO_EXCLUDE = {
    'aburton@cre8media.com', 'admin@fasdcamp.org', 'amanda@fasdcamp.org',
    'anahigareda123@gmail.com', 'andrew.gould@fasdcamp.org', 'dan@fasdcamp.org',
    'emma.ms@fasdcamp.org', 'ericg@cre8media.com', 'joncardenas7@gmail.com',
    'jreed@cre8media.com', 'nicholas.tassone@fasdcamp.org',
    'sydney.finkenbine@gmail.com', 't-ochs@northwestern.edu', 'yianni@fasdcamp.org'
}

# Duplicate camper IDs to skip (keep newest only)
DUPLICATE_CAMPER_IDS_TO_SKIP = {
    1690, 1688,  # Jacob Ellen - keep 1807
    1534, 1451,  # Test Camper - skip all
    669,         # Zackery Jeans - keep 671
}

# Test camper names to skip entirely
TEST_CAMPER_NAMES = {'test camper'}

# VALUE MAPPINGS: WordPress values → New system values
# These mappings transform old data values to match the new dropdown options

# FASD Screener: Old numeric values → New text values
FASD_SCREENER_VALUE_MAP = {
    '0': 'Never',
    '1': 'Sometimes',
    '2': 'Frequently',
    '3': 'Always',
}

# Ethnicity: Old values → New values
ETHNICITY_VALUE_MAP = {
    'Hispanic/Latino': 'Hispanic',
    'White/Caucasian': 'White',
    'Black/African American': 'Black or African American',
    'Asian': 'Other Asian',
    'Native American': 'American Indian or Alaska Native',
    'Pacific Islander': 'Native Hawaiian',
    'Mixed': 'Two or more races',
    'Other': 'Other',
    # Keep exact matches
    'White': 'White',
    'Black or African American': 'Black or African American',
    'Hispanic': 'Hispanic',
    'Chinese': 'Chinese',
    'Filipino': 'Filipino',
    'American Indian or Alaska Native': 'American Indian or Alaska Native',
}

# How did you hear about us: Old values → New values
HOW_HEARD_VALUE_MAP = {
    'Pediatrician referral': 'Other',
    'Doctor/Healthcare provider': 'Other',
    'Friend/Family': 'Referred by Another CAMP Family',
    'Social media': 'Social Media (Instagram, Facebook)',
    'Google': 'Google (Found you searching for a FASD Summer Camp)',
    'FASD United': 'FASD United',
    'Returning family': 'Returning CAMP Family',
    # Any other value maps to 'Other'
}

# Legal Sex: Old values → New values (normalize case)
SEX_VALUE_MAP = {
    'female': 'Female',
    'Female': 'Female',
    'male': 'Male',
    'Male': 'Male',
    'M': 'Male',
    'F': 'Female',
}

# Healthcare provider type mapping
HEALTHCARE_TYPE_MAP = {
    'Primary Care Pediatrician': 'Primary Care',
    'Primary Care': 'Primary Care',
    'Child Psychiatrist': 'Psychiatrist',
    'Psychiatrist': 'Psychiatrist',
    'Psychologist': 'Psychologist',
    'Occupational Therapist': 'Other',
    'Therapist': 'Other',
    'Neurologist': 'Other',
    'Other': 'Other',
}

# Healthcare provider column name mapping (WordPress → New system)
HEALTHCARE_COLUMN_MAP = {
    'name': 'healthcare_providers_name',
    'phone_number': 'healthcare_provider_phone',
    'type': 'healthcare_providers_type',
    'consent_to_contact': 'healthcare_provider_consent_to_contact',
}

# Consent value mapping
CONSENT_VALUE_MAP = {
    'yes': 'Yes',
    'Yes': 'Yes',
    'no': 'No',
    'No': 'No',
}

# Detail field mappings: WordPress detail field → parent WordPress field
# These fields contain additional details that should be stored with the parent field's value
DETAIL_FIELD_MAPPING = {
    'secondary_diagnosis_details': 'is_there_a_secondary_diagnosis',
    'asthma_details': 'does_the_intending_participant_have_any_known_history_of_asthma',
    'seizure_details': 'has_the_intending_participant_ever_had_a_seizure',
}

# Reverse mapping: parent field → detail field (for lookup during migration)
PARENT_TO_DETAIL_FIELD = {v: k for k, v in DETAIL_FIELD_MAPPING.items()}

# Question ID for "Are you a returning camper?" - this needs a response for migrated users
RETURNING_CAMPER_QUESTION_ID = '6db98507-b62a-4ec0-86df-99a063680122'

# Question ID for "Does your potential camper have a nickname?" - set to Yes if nickname exists
NICKNAME_YN_QUESTION_ID = '91459829-b8df-4490-a929-928773ea5636'

# Fields that use FASD Screener value mapping (all 44 screener questions)
FASD_SCREENER_FIELDS = {
    'needs_constant_supervision', 'highly_manipulative', 'exhausted_from_disrupted_sleep',
    'irritable_from_disrupted_sleep', 'doesnt_connect_cause_and_effect',
    'more_difficult_to_manage_in_public_than_at_home', 'cant_easily_distinguish_between_friend_or_foe',
    'impulsive', 'unpredictable', 'engages_in_dangerous_behavior',
    'appears_desperate_for_stimulation_and_excitement', 'moral_chameleon',
    'shows_antisocial_behavior', 'needs_more_structure_and_supervision_than_peers',
    'has_group_learning_andor_using_concept_of_time', 'difficulty_managing_money',
    'overreacts_negatively_to_transitions', 'extremely_vulnerable_to_sales_pitches',
    'doesnt_take_care_of_hygiene_needs', 'unable_to_take_responsibility_for_actions',
    'cannot_consistently_follow_plan_of_action', 'doesnt_follow_rules_of_society',
    'vulnerable_to_depression', 'vulnerable_to_stress_and_overload',
    'lies_andor_replaces_fact_with_fantasy', 'steals_from_family_members',
    'appears_more_capable_than_they_really_are', 'emotionally_volatile_has_outbursts',
    'destructive_with_possessionsobject', 'violent_toward_animals_or_people',
    'void_of_normal_level_of_empathy_for_other', 'unexplained_mood_swings',
    'behavior_doesnt_improve_in_spite_of_consistent_consequences',
    'looks_innocent_when_confirmed_guilty', 'continues_to_deny_guilt_when_confronted',
    'egocentric_acts_on_own_needs_first', 'unable_to_stay_focused_on_task',
    'detached_attitude_toward_own_behavior', 'takes_the_path_of_least_resistance',
    'lives_in_the_moment_shortsighted', 'chooses_immediate_gratification',
    'doesnt_display_remorse', 'not_recognized_by_others_as_disabled',
    'appears_undisciplined_regardless_of_consistent_discipline', 'charismatic',
    'holds_a_grudge', 'doesnt_get_the_whole_picture', 'misunderstands_what_is_expected',
    'predatory_plans_to_harm_others', 'becomes_angry_when_confronted_with_wrongdoing',
    'thinks_they_are_the_exception_to_every_rule', 'has_trouble_remembering_rules',
}

# WordPress field name → Database question_text mapping
# This maps the field names from WordPress camper export to the exact question_text values
# Use dot notation for nested fields (e.g., 'campers_address.camper_address')
WORDPRESS_FIELD_MAPPING = {
    # Basic camper info
    'first_name': 'Camper First Name',
    'middle_name': 'Camper Middle Name',
    'last_name': 'Camper Last Name',
    'date_of_birth': 'Date of Birth',
    'sex': 'Legal Sex',
    'ethnicity': 'Camper Ethnicity',
    'nickname': 'Nickname',
    'photo': 'Camper Photo',

    # Note: Address fields (city, state, country) are NOT persist_annually
    # Families will re-enter these when they reactivate their application

    # Diagnosis fields
    'please_indicate_primary_diagnosis': 'Please Indicate Primary Diagnosis',
    'is_there_a_secondary_diagnosis': 'Is there a secondary diagnosis?',
    'diagnosed_with_other_mental_health_disorders': 'Diagnosed with other mental health disorders?',
    'please_list_all_known_mental_health_diagnoses': 'Please list all known mental health diagnoses',

    # File uploads
    'medical_history_confirmation_form': 'Upload completed Medical History Form',
    'immunizations': 'Upload immunization records',

    # Table-type fields (stored as JSON array)
    'healthcare_providers': 'Healthcare Providers',

    # Adoption fields
    'at_what_age_was_the_child_adopted': 'At what age was the child adopted',
    'please_provide_the_location_of_adoption': 'Please provide the location of adoption',
    'please_provide_the_date_of_adoption': 'Please provide the date of adoption',

    # School/source fields
    'does_intended_participant_attend_school': 'Does intended participant attend school?',
    'name_of_school': 'Name of School',
    'how_did_you_hear_about_us': 'How did you hear about us?',
    'legal_relationship_to_intending_participant': 'Please state your legal relationship to the intending participant',

    # Medical questions
    'does_the_intending_participant_have_any_known_history_of_asthma': 'Does the intending participant have any known history of asthma or shortness of breath?',
    'has_the_intending_participant_ever_had_a_seizure': 'Has the intending participant ever had a seizure?',

    # FASD Screener questions (44 items) - WordPress field → question_text
    'needs_constant_supervision': 'Needs constant supervision',
    'highly_manipulative': 'Highly manipulative',
    'exhausted_from_disrupted_sleep': 'Exhausted from disrupted sleep',
    'irritable_from_disrupted_sleep': 'Irritable from disrupted sleep',
    'doesnt_connect_cause_and_effect': "Doesn't connect cause and effect (behavior and consequences)",
    'more_difficult_to_manage_in_public_than_at_home': 'More difficult to manage in public than at home',
    'cant_easily_distinguish_between_friend_or_foe': "Can't easily distinguish between friend or foe",
    'impulsive': 'Impulsive',
    'unpredictable': 'Unpredictable',
    'engages_in_dangerous_behavior': 'Engages in dangerous behavior',
    'appears_desperate_for_stimulation_and_excitement': 'Appears desperate for stimulation and excitement',
    'moral_chameleon': 'Moral Chameleon (excessively vulnerable to peer pressure)',
    'shows_antisocial_behavior': 'Shows antisocial behavior',
    'needs_more_structure_and_supervision_than_peers': 'Needs more structure and supervision than peers',
    'has_group_learning_andor_using_concept_of_time': 'Has group learning and/or using concept of time',
    'difficulty_managing_money': 'Difficulty managing money',
    'overreacts_negatively_to_transitions': 'Overreacts negatively to transitions',
    'extremely_vulnerable_to_sales_pitches': 'Extremely vulnerable to sales pitches (ads)',
    'doesnt_take_care_of_hygiene_needs': "Doesn't take care of hygiene needs",
    'unable_to_take_responsibility_for_actions': 'Unable to take responsibility for actions',
    'cannot_consistently_follow_plan_of_action': 'Cannot consistently follow plan of action',
    'doesnt_follow_rules_of_society': "Doesn't follow rules of society",
    'vulnerable_to_depression': 'Vulnerable to depression',
    'vulnerable_to_stress_and_overload': 'Vulnerable to stress and overload',
    'lies_andor_replaces_fact_with_fantasy': 'Lies and/or replaces fact with fantasy unconsciously in memory',
    'steals_from_family_members': 'Steals from family members',
    'appears_more_capable_than_they_really_are': 'Appears more capable than they really are',
    'emotionally_volatile_has_outbursts': 'Emotionally volatile\u037e has outbursts',  # U+037E Greek Question Mark
    'destructive_with_possessionsobject': 'Destructive with possessions/object',
    'violent_toward_animals_or_people': 'Violent toward animals or people',
    'void_of_normal_level_of_empathy_for_other': 'Void of normal level of empathy for other',
    'unexplained_mood_swings': 'Unexplained mood swings',
    'behavior_doesnt_improve_in_spite_of_consistent_consequences': "Behavior doesn't improve in spite of consistent consequences",
    'looks_innocent_when_confirmed_guilty': 'Looks innocent when confirmed guilty',
    'continues_to_deny_guilt_when_confronted': 'Continues to deny guilt when confronted with indisputable evidence',
    'egocentric_acts_on_own_needs_first': 'Egocentric — acts on own needs first',
    'unable_to_stay_focused_on_task': 'Unable to stay focused on task',
    'detached_attitude_toward_own_behavior': 'Detached attitude toward own behavior and its consequence',
    'takes_the_path_of_least_resistance': 'Takes the path of least resistance',
    'lives_in_the_moment_shortsighted': 'Lives in the moment-shortsighted',
    'chooses_immediate_gratification': "Chooses immediate gratification (Can't wait for greater benefit)",
    'doesnt_display_remorse': "Doesn't display remorse (Not sorry for doing something wrong)",
    'not_recognized_by_others_as_disabled': 'Not recognized by others as disabled',
    'appears_undisciplined_regardless_of_consistent_discipline': 'Appears undisciplined regardless of consistent discipline/consequences',
    'charismatic': 'Charismatic',
    'holds_a_grudge': 'Holds a grudge',
    'doesnt_get_the_whole_picture': "Doesn't get the whole picture",
    'misunderstands_what_is_expected': 'Misunderstands what is expected',
    'predatory_plans_to_harm_others': 'Predatory-plans to harm others',
    'becomes_angry_when_confronted_with_wrongdoing': 'Becomes angry when confronted with wrongdoing',
    'thinks_they_are_the_exception_to_every_rule': 'Thinks they are the exception to every rule',
    'has_trouble_remembering_rules': 'Has trouble remembering rules from one day to another',
}


class MigrationContext:
    """Holds database connections and configuration"""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.db_url = os.environ.get('DATABASE_URL')
        self.supabase_url = os.environ.get('SUPABASE_URL')
        self.supabase_key = os.environ.get('SUPABASE_KEY')

        if not all([self.db_url, self.supabase_url, self.supabase_key]):
            raise ValueError("Missing required environment variables. Check backend/.env")

        # Initialize database connection
        self.engine = create_engine(self.db_url)
        self.Session = sessionmaker(bind=self.engine)

        # Initialize Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)

        # Cache for persist_annually questions
        self._persist_questions: Optional[Dict] = None
        self._question_id_map: Optional[Dict[str, str]] = None

    def get_session(self):
        return self.Session()

    def get_persist_annually_questions(self) -> Dict[str, Any]:
        """Load questions marked as persist_annually from database"""
        if self._persist_questions is not None:
            return self._persist_questions

        with self.get_session() as session:
            result = session.execute(text("""
                SELECT id, question_text, question_type
                FROM application_questions
                WHERE persist_annually = true AND is_active = true
            """))

            # Build question lookup by question_text (trimmed for matching)
            questions_by_text = {}
            for row in result:
                # Use trimmed text as key but preserve original in value
                key = row.question_text.strip() if row.question_text else ''
                questions_by_text[key] = {
                    'id': str(row.id),
                    'question_text': row.question_text,
                    'question_type': row.question_type
                }

            # Map WordPress field names to question_text values
            self._persist_questions = {}
            for wp_field, question_text in WORDPRESS_FIELD_MAPPING.items():
                if question_text in questions_by_text:
                    self._persist_questions[wp_field] = questions_by_text[question_text]
                else:
                    logger.warning(f"No question found for WordPress field '{wp_field}' -> '{question_text}'")

        logger.info(f"Loaded {len(self._persist_questions)} persist_annually questions mapped to WordPress fields")
        return self._persist_questions


def load_json_file(filepath: str) -> List[Dict]:
    """Load and parse a JSON file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_user_camper_mapping(users: List[Dict], campers: List[Dict]) -> Dict[int, List[Dict]]:
    """
    Build mapping from WordPress user ID to their campers.
    Uses photo.author field to link campers to users.
    """
    mapping: Dict[int, List[Dict]] = {}

    for camper in campers:
        # Skip duplicate camper IDs
        if camper.get('id') in DUPLICATE_CAMPER_IDS_TO_SKIP:
            logger.info(f"Skipping duplicate camper ID {camper.get('id')}: {camper.get('post_title')}")
            continue

        # Skip test campers
        post_title = (camper.get('post_title') or '').lower().strip()
        if post_title in TEST_CAMPER_NAMES:
            logger.info(f"Skipping test camper: {camper.get('post_title')}")
            continue

        # Get author from photo field (WordPress user ID)
        fields = camper.get('fields', {})
        photo = fields.get('photo', {})

        # author can be a string or int
        author_id = photo.get('author') if isinstance(photo, dict) else None
        if author_id is None:
            # Try alternative ways to find the parent user
            author_id = fields.get('_author') or camper.get('post_author')

        if author_id:
            author_id = int(author_id)
            if author_id not in mapping:
                mapping[author_id] = []
            mapping[author_id].append(camper)

    return mapping


def filter_subscriber_users(users: List[Dict]) -> List[Dict]:
    """Filter to only subscriber users, excluding admins"""
    filtered = []
    for user in users:
        email = (user.get('email') or '').lower().strip()
        roles = user.get('role', [])

        # Skip admin emails
        if email in ADMIN_EMAILS_TO_EXCLUDE:
            logger.debug(f"Skipping admin email: {email}")
            continue

        # Skip administrator roles
        if 'administrator' in roles:
            logger.debug(f"Skipping administrator role: {email}")
            continue

        # Only include subscribers
        if 'subscriber' in roles:
            filtered.append(user)

    logger.info(f"Filtered to {len(filtered)} subscriber users (excluded {len(users) - len(filtered)})")
    return filtered


def check_email_exists(ctx: MigrationContext, email: str) -> bool:
    """Check if email already exists in our users table"""
    with ctx.get_session() as session:
        result = session.execute(
            text("SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(:email)"),
            {'email': email}
        )
        count = result.scalar()
        return count > 0


def create_supabase_auth_user(ctx: MigrationContext, email: str, first_name: str, last_name: str) -> Optional[str]:
    """
    Create a user in Supabase Auth without password.
    User must reset password on first login.

    Returns: Supabase auth user ID (UUID string) or None on failure
    """
    if ctx.dry_run:
        fake_id = str(uuid4())
        logger.info(f"[DRY RUN] Would create Supabase auth user: {email} -> {fake_id}")
        return fake_id

    try:
        # Create user with email_confirm=True so they can log in immediately
        # No password means they must use "Forgot Password" to set one
        response = ctx.supabase.auth.admin.create_user({
            "email": email,
            "email_confirm": True,  # Confirm email so they can log in
            "user_metadata": {
                "first_name": first_name,
                "last_name": last_name,
                "role": "user",
                "migrated_from_wordpress": True
            }
        })

        if response and response.user:
            logger.info(f"Created Supabase auth user: {email} -> {response.user.id}")
            return str(response.user.id)
        else:
            logger.error(f"Failed to create Supabase auth user for {email}: No user in response")
            return None

    except Exception as e:
        error_msg = str(e).lower()
        if 'already' in error_msg and 'exist' in error_msg:
            logger.warning(f"User {email} already exists in Supabase Auth")
            # Try to get existing user
            try:
                # Search by email using list_users
                users_response = ctx.supabase.auth.admin.list_users()
                for user in users_response:
                    if hasattr(user, 'email') and user.email.lower() == email.lower():
                        logger.info(f"Found existing Supabase auth user: {email} -> {user.id}")
                        return str(user.id)
            except Exception as e2:
                logger.error(f"Failed to find existing user {email}: {e2}")
        else:
            logger.error(f"Failed to create Supabase auth user for {email}: {e}")
        return None


def create_user_record(
    ctx: MigrationContext,
    supabase_auth_id: str,
    wp_user: Dict
) -> Optional[str]:
    """
    Create or update a user record in our users table.

    IMPORTANT: Supabase has a trigger (on_auth_user_created -> handle_new_supabase_user)
    that automatically creates a user record when an auth user is created.
    This function first checks if that auto-created record exists, and if so,
    UPDATES it with the legacy migration data instead of trying to INSERT.

    Returns: User ID (UUID string) or None on failure
    """
    email = wp_user.get('email', '').strip()
    meta = wp_user.get('meta', {})
    first_name = meta.get('first_name', '') or wp_user.get('display_name', '').split()[0] if wp_user.get('display_name') else ''
    last_name = meta.get('last_name', '') or (wp_user.get('display_name', '').split()[-1] if len(wp_user.get('display_name', '').split()) > 1 else '')
    phone = meta.get('user_phone', '')
    legacy_wp_id = wp_user.get('id')

    if ctx.dry_run:
        logger.info(f"[DRY RUN] Would create/update user record: {email} (legacy_wp_user_id={legacy_wp_id})")
        return str(uuid4())

    with ctx.get_session() as session:
        try:
            # First, check if the trigger already created a user record for this supabase_auth_id
            result = session.execute(
                text("SELECT id FROM users WHERE supabase_auth_id = :supabase_auth_id"),
                {'supabase_auth_id': supabase_auth_id}
            )
            existing_row = result.fetchone()

            if existing_row:
                # User record already exists (created by trigger) - UPDATE it with migration data
                user_id = str(existing_row[0])
                logger.info(f"Found existing user record (from trigger): {email} -> {user_id}, updating with legacy data...")

                session.execute(text("""
                    UPDATE users SET
                        first_name = :first_name,
                        last_name = :last_name,
                        phone = :phone,
                        legacy_wp_user_id = :legacy_wp_id,
                        needs_password_setup = true,
                        updated_at = NOW()
                    WHERE id = :user_id
                """), {
                    'user_id': user_id,
                    'first_name': first_name,
                    'last_name': last_name,
                    'phone': phone,
                    'legacy_wp_id': legacy_wp_id
                })
                session.commit()
                logger.info(f"Updated user record: {email} -> {user_id} (needs_password_setup=true, legacy_wp_user_id={legacy_wp_id})")
                return user_id
            else:
                # No existing record - INSERT new one (fallback, shouldn't happen with trigger active)
                user_id = str(uuid4())
                session.execute(text("""
                    INSERT INTO users (id, supabase_auth_id, email, first_name, last_name, phone, role, legacy_wp_user_id, needs_password_setup, created_at, updated_at)
                    VALUES (:id, :supabase_auth_id, :email, :first_name, :last_name, :phone, 'user', :legacy_wp_id, true, NOW(), NOW())
                """), {
                    'id': user_id,
                    'supabase_auth_id': supabase_auth_id,
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'phone': phone,
                    'legacy_wp_id': legacy_wp_id
                })
                session.commit()
                logger.info(f"Created user record: {email} -> {user_id} (needs_password_setup=true)")
                return user_id
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to create/update user record for {email}: {e}")
            return None


def create_application_record(
    ctx: MigrationContext,
    user_id: str,
    wp_camper: Dict
) -> Optional[str]:
    """
    Create an application record in inactive/deactivated state.

    Returns: Application ID (UUID string) or None on failure
    """
    fields = wp_camper.get('fields', {})
    legacy_wp_id = wp_camper.get('id')

    # Extract camper name
    camper_first = fields.get('first_name', '')
    camper_last = fields.get('last_name', '')

    app_id = str(uuid4())

    if ctx.dry_run:
        logger.info(f"[DRY RUN] Would create application: {camper_first} {camper_last} (legacy_wp_camper_id={legacy_wp_id})")
        return app_id

    with ctx.get_session() as session:
        try:
            session.execute(text("""
                INSERT INTO applications (
                    id, user_id, status, sub_status, is_returning_camper,
                    camper_first_name, camper_last_name,
                    completion_percentage, legacy_wp_camper_id,
                    created_at, updated_at
                )
                VALUES (
                    :id, :user_id, 'inactive', 'inactive', true,
                    :camper_first, :camper_last,
                    0, :legacy_wp_id,
                    NOW(), NOW()
                )
            """), {
                'id': app_id,
                'user_id': user_id,
                'camper_first': camper_first,
                'camper_last': camper_last,
                'legacy_wp_id': legacy_wp_id
            })
            session.commit()
            logger.info(f"Created application: {camper_first} {camper_last} -> {app_id}")
            return app_id
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to create application for {camper_first} {camper_last}: {e}")
            return None


def get_wordpress_field_mapping() -> Dict[str, str]:
    """
    Map WordPress field names to our question field_keys.
    This is the critical mapping between legacy and new systems.
    """
    return {
        # Basic info
        'first_name': 'camper_first_name',
        'middle_name': 'camper_middle_name',
        'last_name': 'camper_last_name',
        'date_of_birth': 'date_of_birth',
        'sex': 'legal_sex',
        'ethnicity': 'camper_ethnicity',

        # Diagnosis
        'please_indicate_primary_diagnosis': 'primary_diagnosis',
        'diagnosed_with_other_mental_health_disorders': 'diagnosed_with_other_mental_health_disorders',
        'please_list_all_known_mental_health_diagnoses': 'mental_health_diagnoses',

        # File uploads
        'photo': 'camper_photo',
        'medical_history_confirmation_form': 'medical_history_confirmation_form',
        'immunizations': 'immunization_records',

        # FASD Screener - direct mapping (WordPress uses same names)
        'needs_constant_supervision': 'needs_constant_supervision',
        'highly_manipulative': 'highly_manipulative',
        'poor_sense_of_boundaries': 'poor_sense_of_boundaries',
        'unable_to_link_cause_and_effect': 'unable_to_link_cause_and_effect',
        'poor_memory': 'poor_memory',
        'doesnt_learn_from_past_experiences': 'doesnt_learn_from_past_experiences',
        'poor_concept_of_time': 'poor_concept_of_time',
        'easily_distracted': 'easily_distracted',
        'interrupts_conversations': 'interrupts_conversations',
        'difficulty_making_transitions': 'difficulty_making_transitions',
        'has_many_unfinished_projects': 'has_many_unfinished_projects',
        'immature_for_age': 'immature_for_age',
        'difficulty_with_abstract_concepts': 'difficulty_with_abstract_concepts',
        'lies_or_confabulates': 'lies_or_confabulates',
        'poor_social_skills': 'poor_social_skills',
        'doesnt_pick_up_on_social_cues': 'doesnt_pick_up_on_social_cues',
        'unpredictable_moods': 'unpredictable_moods',
        'lacks_empathy_or_remorse': 'lacks_empathy_or_remorse',
        'poor_attention': 'poor_attention',
        'misinterprets_information': 'misinterprets_information',
        'overly_friendly_to_strangers': 'overly_friendly_to_strangers',
        'impulsive': 'impulsive',
        'violent_or_aggressive': 'violent_or_aggressive',
        'difficulty_managing_anger': 'difficulty_managing_anger',
        'resistant_to_change': 'resistant_to_change',
        'difficulty_following_multi-step_directions': 'difficulty_following_multi_step_directions',
        'fails_to_consider_consequences_of_actions': 'fails_to_consider_consequences_of_actions',
        'repeats_same_mistakes': 'repeats_same_mistakes',
        'poor_judgment': 'poor_judgment',
        'low_frustration_tolerance': 'low_frustration_tolerance',
        'has_trouble_calming_down': 'has_trouble_calming_down',
        'sleep_problems': 'sleep_problems',
        'motor_coordination_problems': 'motor_coordination_problems',
        'sensory_processing_issues': 'sensory_processing_issues',
        'hearing_problems': 'hearing_problems',
        'vision_problems': 'vision_problems',
        'speech_or_language_problems': 'speech_or_language_problems',
        'difficulty_understanding_abstract_concepts': 'difficulty_understanding_abstract_concepts',
        'difficulty_with_math': 'difficulty_with_math',
        'difficulty_with_reading': 'difficulty_with_reading',
        'difficulty_with_writing': 'difficulty_with_writing',
        'has_required_special_education_services': 'has_required_special_education_services',
        'academic_difficulties': 'academic_difficulties',
        'has_experienced_school_suspensions_or_expulsions': 'has_experienced_school_suspensions_or_expulsions',
    }


def get_nested_value(data: Dict, key_path: str) -> Any:
    """
    Get a value from a nested dict using dot notation.

    Examples:
        get_nested_value({'a': {'b': 'value'}}, 'a.b') -> 'value'
        get_nested_value({'a': 'value'}, 'a') -> 'value'
        get_nested_value({'a': {'b': 'value'}}, 'a.c') -> None
    """
    keys = key_path.split('.')
    current = data

    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return None

    return current


def transform_date_format(date_str: str) -> str:
    """
    Transform date from MM/DD/YYYY to YYYY-MM-DD (ISO format for HTML date inputs).

    Args:
        date_str: Date string in MM/DD/YYYY format

    Returns:
        Date string in YYYY-MM-DD format, or original if parsing fails
    """
    if not date_str:
        return date_str

    # Try MM/DD/YYYY format
    import re
    match = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', date_str.strip())
    if match:
        month, day, year = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # Already in ISO format or other format - return as is
    return date_str


def transform_healthcare_providers(providers: list) -> list:
    """
    Transform healthcare providers from WordPress format to new system format.

    WordPress format:
        {"name": "Dr. Smith", "phone_number": "555-1234", "type": "Primary Care Pediatrician", "consent_to_contact": "yes"}

    New system format:
        {"healthcare_providers_name": "Dr. Smith", "healthcare_provider_phone": "555-1234",
         "healthcare_providers_type": "Primary Care", "healthcare_provider_consent_to_contact": "Yes"}
    """
    if not providers or not isinstance(providers, list):
        return []

    transformed = []
    for provider in providers:
        if not provider or not isinstance(provider, dict):
            continue

        new_provider = {}
        for old_key, new_key in HEALTHCARE_COLUMN_MAP.items():
            if old_key in provider:
                value = provider[old_key]

                # Transform type values
                if old_key == 'type':
                    value = HEALTHCARE_TYPE_MAP.get(value, 'Other')

                # Transform consent values
                if old_key == 'consent_to_contact':
                    value = CONSENT_VALUE_MAP.get(value, 'Yes')

                new_provider[new_key] = value

        # Only add if we have some data
        if new_provider:
            transformed.append(new_provider)

    return transformed


def transform_value(wp_field: str, value: str) -> str:
    """
    Transform a WordPress value to match the new system's dropdown options.

    Args:
        wp_field: The WordPress field name (e.g., 'ethnicity', 'needs_constant_supervision')
        value: The original value from WordPress

    Returns:
        The transformed value that matches the new system's options
    """
    if value is None:
        return None

    str_value = str(value).strip()

    # FASD Screener questions use numeric values (0-3) → text values
    if wp_field in FASD_SCREENER_FIELDS:
        return FASD_SCREENER_VALUE_MAP.get(str_value, str_value)

    # Ethnicity mapping
    if wp_field == 'ethnicity':
        return ETHNICITY_VALUE_MAP.get(str_value, 'Other')

    # How did you hear about us mapping
    if wp_field == 'how_did_you_hear_about_us':
        return HOW_HEARD_VALUE_MAP.get(str_value, 'Other')

    # Legal Sex mapping (normalize case)
    if wp_field == 'sex':
        return SEX_VALUE_MAP.get(str_value, str_value)

    # Date fields need format conversion (MM/DD/YYYY → YYYY-MM-DD)
    if wp_field in ('date_of_birth', 'please_provide_the_date_of_adoption'):
        return transform_date_format(str_value)

    # No transformation needed for other fields
    return str_value


def migrate_application_responses(
    ctx: MigrationContext,
    app_id: str,
    wp_camper: Dict
) -> int:
    """
    Migrate persist_annually field values as application_responses.

    Iterates through all MAPPED fields (from WORDPRESS_FIELD_MAPPING) and creates
    responses for any field that has data in the WordPress camper.
    Supports nested field access using dot notation (e.g., 'campers_address.camper_address').
    Transforms values to match the new system's dropdown options.

    Returns: Number of responses created
    """
    fields = wp_camper.get('fields', {})
    persist_questions = ctx.get_persist_annually_questions()

    responses_created = 0

    # Iterate through all MAPPED WordPress fields (keys in persist_questions)
    for wp_field_path, question in persist_questions.items():
        # Get value using dot notation for nested access
        value = get_nested_value(fields, wp_field_path)

        # Skip empty values
        if value is None or value == '':
            continue

        # Skip file fields (handled separately in migrate_file_fields)
        if isinstance(value, dict) and ('filename' in value or 'url' in value or 'ID' in value):
            continue

        question_id = question['id']
        question_type = question.get('question_type', '')

        # Get the base field name (without nested path) for transformation
        base_field = wp_field_path.split('.')[-1] if '.' in wp_field_path else wp_field_path

        # Convert value to string for storage
        # For table/array types (like healthcare_providers), convert to JSON
        if isinstance(value, (list, dict)):
            # Filter out empty entries in lists
            if isinstance(value, list):
                value = [item for item in value if item and any(v for v in item.values() if v)]
                if not value:  # Skip if list becomes empty after filtering
                    continue

                # Special handling for healthcare_providers - transform column names and values
                if base_field == 'healthcare_providers':
                    value = transform_healthcare_providers(value)

            response_value = json.dumps(value)
        else:
            # Transform the value to match new system's dropdown options
            transformed_value = transform_value(base_field, value)

            # Check if this field has an associated detail field
            # If so, combine the value and detail into JSON format: {"value": "Yes", "detail": "..."}
            detail_field_name = PARENT_TO_DETAIL_FIELD.get(base_field)
            if detail_field_name:
                detail_value = fields.get(detail_field_name)
                if detail_value and str(detail_value).strip():
                    # Combine parent value and detail into JSON
                    response_value = json.dumps({
                        "value": transformed_value,
                        "detail": str(detail_value).strip()
                    })
                    logger.info(f"  Combined detail field: {base_field} = {transformed_value} + detail from {detail_field_name}")
                else:
                    response_value = transformed_value
            else:
                response_value = transformed_value

        if ctx.dry_run:
            logger.debug(f"[DRY RUN] Would create response: {wp_field_path} = {response_value[:50] if response_value else None}...")
            responses_created += 1
            continue

        with ctx.get_session() as session:
            try:
                session.execute(text("""
                    INSERT INTO application_responses (id, application_id, question_id, response_value, created_at, updated_at)
                    VALUES (:id, :app_id, :question_id, :response_value, NOW(), NOW())
                    ON CONFLICT (application_id, question_id) DO UPDATE SET
                        response_value = EXCLUDED.response_value,
                        updated_at = NOW()
                """), {
                    'id': str(uuid4()),
                    'app_id': app_id,
                    'question_id': question_id,
                    'response_value': response_value
                })
                session.commit()
                responses_created += 1
            except Exception as e:
                session.rollback()
                logger.error(f"Failed to create response for {wp_field_path}: {e}")

    logger.info(f"Created {responses_created} application responses for app {app_id}")
    return responses_created


def upload_file_to_storage(
    ctx: MigrationContext,
    app_id: str,
    question_id: str,
    wp_user_id: int,
    file_info: Dict,
    private_folder: str
) -> Optional[str]:
    """
    Upload a file from the _private folder to Supabase Storage.

    Returns: File ID (UUID string) or None on failure
    """
    filename = file_info.get('filename')
    if not filename:
        return None

    # Build local file path
    file_path = Path(private_folder) / str(wp_user_id) / filename

    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return None

    file_id = str(uuid4())

    if ctx.dry_run:
        logger.info(f"[DRY RUN] Would upload file: {file_path}")
        return file_id

    try:
        # Read file content
        with open(file_path, 'rb') as f:
            file_content = f.read()

        # Determine content type
        extension = filename.lower().split('.')[-1]
        content_types = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
        content_type = content_types.get(extension, 'application/octet-stream')

        # Upload to Supabase Storage
        storage_path = f"applications/{app_id}/{question_id}/{filename}"
        bucket_name = "application-files"

        # Ensure bucket exists
        try:
            ctx.supabase.storage.get_bucket(bucket_name)
        except:
            ctx.supabase.storage.create_bucket(bucket_name, options={"public": False})

        # Upload file
        ctx.supabase.storage.from_(bucket_name).upload(
            path=storage_path,
            file=file_content,
            file_options={"content-type": content_type, "upsert": "true"}
        )

        # Create file record in database
        with ctx.get_session() as session:
            session.execute(text("""
                INSERT INTO files (id, application_id, uploaded_by, file_name, storage_path, file_size, file_type, created_at)
                VALUES (:id, :app_id, :user_id, :filename, :storage_path, :file_size, :content_type, NOW())
            """), {
                'id': file_id,
                'app_id': app_id,
                'user_id': None,  # System upload
                'filename': filename,
                'storage_path': storage_path,
                'file_size': len(file_content),
                'content_type': content_type
            })
            session.commit()

        logger.info(f"Uploaded file: {filename} -> {storage_path}")
        return file_id

    except Exception as e:
        logger.error(f"Failed to upload file {filename}: {e}")
        return None


def migrate_file_fields(
    ctx: MigrationContext,
    app_id: str,
    wp_camper: Dict,
    wp_user_id: int,
    private_folder: str
) -> int:
    """
    Migrate file fields (photo, immunizations, medical history form).
    These are persist_annually file_upload and profile_picture type questions.

    Returns: Number of files migrated
    """
    fields = wp_camper.get('fields', {})
    persist_questions = ctx.get_persist_annually_questions()

    # File fields that are mapped in WORDPRESS_FIELD_MAPPING
    file_fields = ['photo', 'medical_history_confirmation_form', 'immunizations']
    files_uploaded = 0

    for wp_field in file_fields:
        file_info = fields.get(wp_field)

        # Skip if no file info
        if not file_info or not isinstance(file_info, dict):
            continue

        if not file_info.get('filename'):
            continue

        # Find question ID using WordPress field name (persist_questions is keyed by WP field names)
        question = persist_questions.get(wp_field)

        if not question:
            logger.warning(f"No question found for file field: {wp_field}")
            continue

        question_id = question['id']

        # Upload file
        file_id = upload_file_to_storage(
            ctx, app_id, question_id, wp_user_id, file_info, private_folder
        )

        if file_id:
            # Create application_response linking to file
            if not ctx.dry_run:
                with ctx.get_session() as session:
                    try:
                        session.execute(text("""
                            INSERT INTO application_responses (id, application_id, question_id, file_id, created_at, updated_at)
                            VALUES (:id, :app_id, :question_id, :file_id, NOW(), NOW())
                            ON CONFLICT (application_id, question_id) DO UPDATE SET
                                file_id = EXCLUDED.file_id,
                                updated_at = NOW()
                        """), {
                            'id': str(uuid4()),
                            'app_id': app_id,
                            'question_id': question_id,
                            'file_id': file_id
                        })
                        session.commit()
                    except Exception as e:
                        session.rollback()
                        logger.error(f"Failed to create file response: {e}")

            files_uploaded += 1

    logger.info(f"Uploaded {files_uploaded} files for application {app_id}")
    return files_uploaded


def set_returning_camper_response(ctx: MigrationContext, app_id: str) -> bool:
    """
    Set the "Are you a returning camper?" question to "Yes" for migrated applications.

    All migrated campers are returning campers by definition (they existed in the old system).

    Returns: True if successful, False otherwise
    """
    if ctx.dry_run:
        logger.info(f"[DRY RUN] Would set returning camper response to 'Yes' for app {app_id}")
        return True

    with ctx.get_session() as session:
        try:
            session.execute(text("""
                INSERT INTO application_responses (id, application_id, question_id, response_value, created_at, updated_at)
                VALUES (:id, :app_id, :question_id, 'Yes', NOW(), NOW())
                ON CONFLICT (application_id, question_id) DO UPDATE SET
                    response_value = 'Yes',
                    updated_at = NOW()
            """), {
                'id': str(uuid4()),
                'app_id': app_id,
                'question_id': RETURNING_CAMPER_QUESTION_ID
            })
            session.commit()
            logger.info(f"Set returning camper = Yes for app {app_id}")
            return True
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to set returning camper response: {e}")
            return False


def set_nickname_yn_response(ctx: MigrationContext, app_id: str, nickname: str) -> bool:
    """
    Set the "Does your potential camper have a nickname?" question to "Yes" if nickname exists.

    WordPress data only has the nickname text, not a separate Y/N field.
    If the nickname has a value, we set the Y/N question to "Yes".

    Returns: True if successful (or no nickname), False on error
    """
    # Only set if nickname has a value
    if not nickname or not str(nickname).strip():
        return True  # No nickname, nothing to do

    if ctx.dry_run:
        logger.info(f"[DRY RUN] Would set nickname Y/N = 'Yes' for app {app_id}")
        return True

    with ctx.get_session() as session:
        try:
            session.execute(text("""
                INSERT INTO application_responses (id, application_id, question_id, response_value, created_at, updated_at)
                VALUES (:id, :app_id, :question_id, 'Yes', NOW(), NOW())
                ON CONFLICT (application_id, question_id) DO UPDATE SET
                    response_value = 'Yes',
                    updated_at = NOW()
            """), {
                'id': str(uuid4()),
                'app_id': app_id,
                'question_id': NICKNAME_YN_QUESTION_ID
            })
            session.commit()
            logger.info(f"Set nickname Y/N = Yes for app {app_id}")
            return True
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to set nickname Y/N response: {e}")
            return False


def run_migration(
    users_file: str,
    campers_file: str,
    private_folder: str,
    dry_run: bool = False,
    single_user_id: Optional[int] = None
):
    """
    Main migration function.

    Args:
        users_file: Path to users JSON export
        campers_file: Path to campers JSON export
        private_folder: Path to _private folder with uploaded files
        dry_run: If True, don't make actual changes
        single_user_id: If set, only migrate this WordPress user ID (for testing)
    """
    logger.info("=" * 60)
    logger.info("WordPress to Supabase Data Migration")
    logger.info(f"Dry run: {dry_run}")
    logger.info(f"Single user ID: {single_user_id or 'None (all users)'}")
    logger.info("=" * 60)

    # Initialize context
    ctx = MigrationContext(dry_run=dry_run)

    # Load data files
    logger.info(f"Loading users from: {users_file}")
    users = load_json_file(users_file)
    logger.info(f"Loaded {len(users)} total users")

    logger.info(f"Loading campers from: {campers_file}")
    campers = load_json_file(campers_file)
    logger.info(f"Loaded {len(campers)} total campers")

    # Filter to subscribers only
    users = filter_subscriber_users(users)

    # Filter to single user if specified
    if single_user_id:
        users = [u for u in users if u.get('id') == single_user_id]
        logger.info(f"Filtered to single user ID {single_user_id}: {len(users)} users")

    # Build user->camper mapping
    user_camper_map = build_user_camper_mapping(users, campers)
    logger.info(f"Built mapping for {len(user_camper_map)} users with campers")

    # Pre-load persist_annually questions
    ctx.get_persist_annually_questions()

    # Stats
    stats = {
        'users_processed': 0,
        'users_created': 0,
        'users_skipped_existing': 0,
        'users_skipped_no_campers': 0,
        'applications_created': 0,
        'responses_created': 0,
        'files_uploaded': 0,
        'errors': []
    }

    # Process each user
    for user in users:
        wp_user_id = user.get('id')
        email = user.get('email', '').strip()

        stats['users_processed'] += 1
        logger.info(f"\n--- Processing user {stats['users_processed']}/{len(users)}: {email} (WP ID: {wp_user_id}) ---")

        # Check if user has campers
        campers_for_user = user_camper_map.get(wp_user_id, [])
        if not campers_for_user:
            logger.warning(f"User {email} has no campers, skipping")
            stats['users_skipped_no_campers'] += 1
            continue

        # Check if email already exists
        if check_email_exists(ctx, email):
            logger.warning(f"User {email} already exists in database, skipping")
            stats['users_skipped_existing'] += 1
            continue

        # Create Supabase Auth user
        meta = user.get('meta', {})
        first_name = meta.get('first_name', '')
        last_name = meta.get('last_name', '')

        supabase_auth_id = create_supabase_auth_user(ctx, email, first_name, last_name)
        if not supabase_auth_id:
            stats['errors'].append(f"Failed to create Supabase auth user: {email}")
            continue

        # Create user record
        user_id = create_user_record(ctx, supabase_auth_id, user)
        if not user_id:
            stats['errors'].append(f"Failed to create user record: {email}")
            continue

        stats['users_created'] += 1

        # Process each camper for this user
        for camper in campers_for_user:
            camper_name = camper.get('post_title', 'Unknown')
            logger.info(f"  Processing camper: {camper_name}")

            # Create application
            app_id = create_application_record(ctx, user_id, camper)
            if not app_id:
                stats['errors'].append(f"Failed to create application for camper: {camper_name}")
                continue

            stats['applications_created'] += 1

            # Migrate field responses
            responses = migrate_application_responses(ctx, app_id, camper)
            stats['responses_created'] += responses

            # Set "Are you a returning camper?" to Yes (all migrated campers are returning)
            if set_returning_camper_response(ctx, app_id):
                stats['responses_created'] += 1

            # Set "Does your potential camper have a nickname?" to Yes if nickname exists
            fields = camper.get('fields', {})
            nickname = fields.get('nickname', '')
            if nickname and set_nickname_yn_response(ctx, app_id, nickname):
                stats['responses_created'] += 1

            # Migrate file fields
            files = migrate_file_fields(ctx, app_id, camper, wp_user_id, private_folder)
            stats['files_uploaded'] += files

    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("Migration Complete - Summary")
    logger.info("=" * 60)
    logger.info(f"Users processed:       {stats['users_processed']}")
    logger.info(f"Users created:         {stats['users_created']}")
    logger.info(f"Users skipped (exist): {stats['users_skipped_existing']}")
    logger.info(f"Users skipped (no campers): {stats['users_skipped_no_campers']}")
    logger.info(f"Applications created:  {stats['applications_created']}")
    logger.info(f"Responses created:     {stats['responses_created']}")
    logger.info(f"Files uploaded:        {stats['files_uploaded']}")
    logger.info(f"Errors:                {len(stats['errors'])}")

    if stats['errors']:
        logger.info("\nErrors:")
        for error in stats['errors']:
            logger.error(f"  - {error}")

    return stats


def main():
    parser = argparse.ArgumentParser(description='Migrate WordPress data to Supabase')
    parser.add_argument('--test', action='store_true', help='Use test data files instead of production')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without making them')
    parser.add_argument('--user-id', type=int, help='Only migrate a specific WordPress user ID')

    args = parser.parse_args()

    # Determine file paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    if args.test:
        users_file = script_dir / 'test_migration_user.json'
        campers_file = script_dir / 'test_migration_camper.json'
    else:
        users_file = project_root / 'migration-data' / 'users_export_2025-12-29.json'
        campers_file = project_root / 'migration-data' / 'camper_export_2025-12-29.json'

    private_folder = project_root / 'migration-data' / '_private'

    # Validate files exist
    if not users_file.exists():
        logger.error(f"Users file not found: {users_file}")
        sys.exit(1)

    if not campers_file.exists():
        logger.error(f"Campers file not found: {campers_file}")
        sys.exit(1)

    if not private_folder.exists():
        logger.warning(f"Private folder not found: {private_folder} (file uploads will be skipped)")

    # Run migration
    run_migration(
        users_file=str(users_file),
        campers_file=str(campers_file),
        private_folder=str(private_folder),
        dry_run=args.dry_run,
        single_user_id=args.user_id
    )


if __name__ == '__main__':
    main()
