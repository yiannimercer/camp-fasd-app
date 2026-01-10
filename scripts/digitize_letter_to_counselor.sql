-- Digitize "Letter to My Counselor" Section
-- Converts the PDF form into digital questions
-- Section ID: 66297928-5977-4e25-acc0-786fac379066
--
-- This section appears AFTER camper is accepted (required_status = 'camper')

-- ============================================================================
-- STEP 1: Update section description with markdown
-- ============================================================================
UPDATE application_sections
SET description = '## Dear Counselor! 👋

This section is designed to be **filled out by your camper** (with your help if needed). It helps our counselors get to know each camper before camp begins.

### What''s included:
- **A Letter to My Counselor** - Your camper''s own words about themselves
- **Behavior Policy** - Acknowledgment of camp behavior expectations

*Please sit down with your camper and help them share their thoughts in their own words!*',
    updated_at = NOW()
WHERE id = '66297928-5977-4e25-acc0-786fac379066';

-- ============================================================================
-- STEP 2: Remove the old file upload question
-- ============================================================================
DELETE FROM application_questions
WHERE section_id = '66297928-5977-4e25-acc0-786fac379066';

-- ============================================================================
-- STEP 3: Add header for Letter to My Counselor
-- ============================================================================
INSERT INTO application_headers (id, section_id, header_text, order_index, is_active)
VALUES (
    'a1b2c3d4-1111-4444-aaaa-111111111111',
    '66297928-5977-4e25-acc0-786fac379066',
    'A Letter to My Counselor',
    0,
    true
) ON CONFLICT (id) DO UPDATE SET
    header_text = EXCLUDED.header_text,
    order_index = EXCLUDED.order_index;

-- ============================================================================
-- STEP 4: Add Letter to My Counselor questions
-- ============================================================================

-- Q1: Nickname
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-2222-4444-aaaa-222222222222',
    '66297928-5977-4e25-acc0-786fac379066',
    'My friends call me',
    'text',
    false,
    1,
    'What nickname or name do your friends use for you?',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q2: Things I like to do at home
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-3333-4444-aaaa-333333333333',
    '66297928-5977-4e25-acc0-786fac379066',
    'At home the things I like to do are',
    'textarea',
    true,
    2,
    'Tell us about your favorite activities and hobbies at home',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q3: Things I'm good at
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-4444-4444-aaaa-444444444444',
    '66297928-5977-4e25-acc0-786fac379066',
    'I am good at',
    'textarea',
    true,
    3,
    'What are your strengths and talents?',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q4: Why I'm coming to CAMP
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-5555-4444-aaaa-555555555555',
    '66297928-5977-4e25-acc0-786fac379066',
    'I am coming to CAMP because',
    'textarea',
    true,
    4,
    'Why are you excited to come to CAMP?',
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q5: Things I want to do at CAMP
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-6666-4444-aaaa-666666666666',
    '66297928-5977-4e25-acc0-786fac379066',
    'When I get to CAMP the things I want to do most are',
    'textarea',
    true,
    5,
    'What activities are you most looking forward to?',
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q6: Things I don't want to do at CAMP
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-7777-4444-aaaa-777777777777',
    '66297928-5977-4e25-acc0-786fac379066',
    'When I am at CAMP I don''t want to',
    'textarea',
    false,
    6,
    'Is there anything you''d prefer not to do?',
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q7: Friends I get along with
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-8888-4444-aaaa-888888888888',
    '66297928-5977-4e25-acc0-786fac379066',
    'I get along with friends who',
    'textarea',
    true,
    7,
    'What kind of friends do you enjoy spending time with?',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q8: Kind of counselor I want
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-9999-4444-aaaa-999999999999',
    '66297928-5977-4e25-acc0-786fac379066',
    'The kind of counselor I would want to have most is one who',
    'textarea',
    true,
    8,
    'Describe your ideal counselor',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q9: Anything else
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-aaaa-4444-aaaa-aaaaaaaaaaaa',
    '66297928-5977-4e25-acc0-786fac379066',
    'I would also like you to know',
    'textarea',
    false,
    9,
    'Anything else you''d like to share with your counselor?',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Q10: Camper signature for letter
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-bbbb-4444-aaaa-bbbbbbbbbbbb',
    '66297928-5977-4e25-acc0-786fac379066',
    'Camper''s Signature',
    'signature',
    true,
    10,
    'Camper: Please sign your name here',
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 5: Add header for Behavior Policy
-- ============================================================================
INSERT INTO application_headers (id, section_id, header_text, order_index, is_active)
VALUES (
    'a1b2c3d4-cccc-4444-aaaa-cccccccccccc',
    '66297928-5977-4e25-acc0-786fac379066',
    'Behavior Policy',
    11,
    true
) ON CONFLICT (id) DO UPDATE SET
    header_text = EXCLUDED.header_text,
    order_index = EXCLUDED.order_index;

-- ============================================================================
-- STEP 6: Add Behavior Policy questions
-- ============================================================================

-- Behavior Policy acknowledgment (informational text + checkbox)
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-dddd-4444-aaaa-dddddddddddd',
    '66297928-5977-4e25-acc0-786fac379066',
    'I have read and understand the Behavior Policy',
    'checkbox',
    true,
    12,
    '**General Behavior Rules:**
- **Be Respectful:** Respect yourself, others and property.
- **Be Safe:** Stay with a CAMP counselor and CAMP buddy. Follow the rules during camp activities.
- **Participate in Camp Activities:** We encourage campers to try all activities unless excused by staff. Campers are supervised at all times and cannot be left alone.
- **Follow Directions:** We ask campers to follow staff directions to assist with camp safety.

**Unacceptable Behavior:**
- Using inappropriate language
- Physical violence or bullying
- Stealing or damaging personal or camp property
- Leaving program without permission
- Endangering the health and safety of yourself or others
- Refusal to participate in activities or cooperate with staff

If inappropriate behavior continues, parents will be notified and the camper may be dismissed from camp.',
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Camper signature for behavior policy
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-eeee-4444-aaaa-eeeeeeeeeeee',
    '66297928-5977-4e25-acc0-786fac379066',
    'Camper''s Signature (Behavior Policy)',
    'signature',
    true,
    13,
    'Camper: I agree to follow the behavior rules at CAMP',
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Parent signature for behavior policy
INSERT INTO application_questions (
    id, section_id, question_text, question_type, is_required, order_index,
    description, persist_annually, created_at, updated_at
) VALUES (
    'a1b2c3d4-ffff-4444-aaaa-ffffffffffff',
    '66297928-5977-4e25-acc0-786fac379066',
    'Parent/Guardian''s Signature (Behavior Policy)',
    'signature',
    true,
    14,
    'Parent/Guardian: I have reviewed the behavior policy with my camper',
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION: Check the results
-- ============================================================================
-- Run this after to verify:
-- SELECT id, question_text, question_type, order_index FROM application_questions
-- WHERE section_id = '66297928-5977-4e25-acc0-786fac379066' ORDER BY order_index;
