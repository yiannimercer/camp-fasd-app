-- Letter to My Counselor Section - Production Sync from Dev
-- Section ID: 66297928-5977-4e25-acc0-786fac379066
-- Exported from dev on 2026-01-10

-- ============================================================================
-- STEP 1: Update section (title and description)
-- ============================================================================
UPDATE application_sections
SET
    title = 'Letter to My Counselor (Camper to Complete)',
    description = 'This section is designed to be **filled out by your camper** (with your help if needed). It helps our counselors get to know each camper before camp begins.',
    updated_at = NOW()
WHERE id = '66297928-5977-4e25-acc0-786fac379066';

-- ============================================================================
-- STEP 2: Remove old file upload question if exists
-- ============================================================================
DELETE FROM application_questions
WHERE section_id = '66297928-5977-4e25-acc0-786fac379066'
  AND id = 'b13e0dbd-84fb-4655-93f8-09762d178302';

-- ============================================================================
-- STEP 3: Insert headers
-- ============================================================================
INSERT INTO application_headers (id, section_id, header_text, order_index, is_active, created_at, updated_at)
VALUES
    ('a1b2c3d4-1111-4444-aaaa-111111111111', '66297928-5977-4e25-acc0-786fac379066', 'A Letter to My Counselor', 0, true, NOW(), NOW()),
    ('a1b2c3d4-cccc-4444-aaaa-cccccccccccc', '66297928-5977-4e25-acc0-786fac379066', 'Behavior Policy', 11, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    header_text = EXCLUDED.header_text,
    order_index = EXCLUDED.order_index,
    updated_at = NOW();

-- ============================================================================
-- STEP 4: Insert all 13 questions
-- ============================================================================

-- Q1: My friends call me
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-2222-4444-aaaa-222222222222', '66297928-5977-4e25-acc0-786fac379066', 'My friends call me', 'text', '[]', false, false, 1, true, 'What nickname or name do your friends use for you?', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q2: At home the things I like to do are
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-3333-4444-aaaa-333333333333', '66297928-5977-4e25-acc0-786fac379066', 'At home the things I like to do are', 'textarea', '[]', true, false, 2, true, 'Tell us about your favorite activities and hobbies at home', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q3: I am good at
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-4444-4444-aaaa-444444444444', '66297928-5977-4e25-acc0-786fac379066', 'I am good at', 'textarea', '[]', true, false, 3, true, 'What are your strengths and talents?', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q4: I am coming to CAMP because
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-5555-4444-aaaa-555555555555', '66297928-5977-4e25-acc0-786fac379066', 'I am coming to CAMP because', 'textarea', NULL, true, false, 4, true, 'Why are you excited to come to CAMP?', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q5: When I get to CAMP the things I want to do most are
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-6666-4444-aaaa-666666666666', '66297928-5977-4e25-acc0-786fac379066', 'When I get to CAMP the things I want to do most are', 'textarea', NULL, true, false, 5, true, 'What activities are you most looking forward to?', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q6: When I am at CAMP I don't want to
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-7777-4444-aaaa-777777777777', '66297928-5977-4e25-acc0-786fac379066', 'When I am at CAMP I don''t want to', 'textarea', NULL, false, false, 6, true, 'Is there anything you''d prefer not to do?', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q7: I get along with friends who
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-8888-4444-aaaa-888888888888', '66297928-5977-4e25-acc0-786fac379066', 'I get along with friends who', 'textarea', '[]', true, false, 7, true, 'What kind of friends do you enjoy spending time with?', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q8: The kind of counselor I would want to have most is one who
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-9999-4444-aaaa-999999999999', '66297928-5977-4e25-acc0-786fac379066', 'The kind of counselor I would want to have most is one who', 'textarea', '[]', true, false, 8, true, 'Describe your ideal counselor', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q9: I would also like you to know
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-aaaa-4444-aaaa-aaaaaaaaaaaa', '66297928-5977-4e25-acc0-786fac379066', 'I would also like you to know', 'textarea', '[]', false, false, 9, true, 'Anything else you''d like to share with your counselor?', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q10: Camper's Signature
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-bbbb-4444-aaaa-bbbbbbbbbbbb', '66297928-5977-4e25-acc0-786fac379066', 'Camper''s Signature', 'signature', NULL, true, false, 10, true, 'Camper: Please sign your name here', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q11: I have read and understand the Behavior Policy (checkbox with markdown description)
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-dddd-4444-aaaa-dddddddddddd', '66297928-5977-4e25-acc0-786fac379066', 'I have read and understand the Behavior Policy', 'checkbox', NULL, true, false, 12, true, E'**General Behavior Rules:**\n- **Be Respectful:** Respect yourself, others and property.\n- **Be Safe:** Stay with a CAMP counselor and CAMP buddy. Follow the rules during camp activities.\n- **Participate in Camp Activities:** We encourage campers to try all activities unless excused by staff. Campers are supervised at all times and cannot be left alone.\n- **Follow Directions:** We ask campers to follow staff directions to assist with camp safety.\n\n**Unacceptable Behavior:**\n- Using inappropriate language\n- Physical violence or bullying\n- Stealing or damaging personal or camp property\n- Leaving program without permission\n- Endangering the health and safety of yourself or others\n- Refusal to participate in activities or cooperate with staff\n\nIf inappropriate behavior continues, parents will be notified and the camper may be dismissed from camp.', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q12: Camper's Signature (Behavior Policy)
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-eeee-4444-aaaa-eeeeeeeeeeee', '66297928-5977-4e25-acc0-786fac379066', 'Camper''s Signature (Behavior Policy)', 'signature', NULL, true, false, 13, true, 'Camper: I agree to follow the behavior rules at CAMP', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- Q13: Parent/Guardian's Signature (Behavior Policy)
INSERT INTO application_questions (id, section_id, question_text, question_type, options, is_required, reset_annually, order_index, is_active, description, persist_annually, created_at, updated_at)
VALUES ('a1b2c3d4-ffff-4444-aaaa-ffffffffffff', '66297928-5977-4e25-acc0-786fac379066', 'Parent/Guardian''s Signature (Behavior Policy)', 'signature', NULL, true, false, 14, true, 'Parent/Guardian: I have reviewed the behavior policy with my camper', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    is_required = EXCLUDED.is_required,
    order_index = EXCLUDED.order_index,
    description = EXCLUDED.description,
    persist_annually = EXCLUDED.persist_annually,
    updated_at = NOW();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run after: SELECT question_text, order_index FROM application_questions
-- WHERE section_id = '66297928-5977-4e25-acc0-786fac379066' ORDER BY order_index;
