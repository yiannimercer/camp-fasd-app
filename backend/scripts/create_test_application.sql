-- ============================================================================
-- Create Complete Test Application with VALID Responses
-- Picks actual valid values from question options
-- Does NOT hardcode any completion values - system calculates naturally
-- ============================================================================

-- ======================================================
-- CONFIGURATION - Change these values for different test scenarios
-- ======================================================
-- Scenario A (Full Payment): first='StripeTest', last='FullPay'
-- Scenario B (Scholarship):  first='StripeTest', last='Scholarship'
-- Scenario C (Payment Plan): first='StripeTest', last='PayPlan'
-- ======================================================

DO $$
DECLARE
    -- TEST CONFIGURATION - CHANGE THESE VALUES
    v_camper_first_name TEXT := 'CompletionTest';
    v_camper_last_name TEXT := 'BugFix';

    v_user_id UUID := '6eea99ab-cc77-40c5-a299-dbf7eade0829';  -- yianni@fasdcamp.org
    v_app_id UUID;
    v_file_id UUID;
    v_question RECORD;
    v_response_value TEXT;
    v_first_option TEXT;
    v_file_counter INT := 0;
BEGIN
    -- Create the application with minimal info - NO completion hardcoding
    INSERT INTO applications (
        user_id,
        camper_first_name,
        camper_last_name,
        camper_age,
        camper_gender,
        status,
        sub_status,
        is_returning_camper,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_camper_first_name,
        v_camper_last_name,
        11,
        'Female',
        'applicant',
        'not_started',
        false,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_app_id;

    RAISE NOTICE 'Created application: %', v_app_id;

    -- Loop through ALL required questions for applicants
    FOR v_question IN
        SELECT q.id, q.question_type, q.question_text, q.options, s.title as section_title
        FROM application_questions q
        JOIN application_sections s ON q.section_id = s.id
        WHERE q.is_active = true
          AND q.is_required = true
          AND s.is_active = true
          AND (s.required_status IS NULL OR s.required_status = 'applicant')
          AND (q.show_when_status IS NULL OR q.show_when_status = 'applicant')
        ORDER BY s.order_index, q.order_index
    LOOP
        v_file_id := NULL;
        v_response_value := NULL;

        -- Special handling for camper name questions to use configured names
        IF v_question.question_text = 'Camper First Name' THEN
            v_response_value := v_camper_first_name;
        ELSIF v_question.question_text = 'Camper Last Name' THEN
            v_response_value := v_camper_last_name;
        -- SKIP the Authorizations checkbox to leave at 92% - user will complete manually
        ELSIF v_question.question_text = 'Authorizations' AND v_question.question_type = 'checkbox' THEN
            RAISE NOTICE 'Skipping Authorizations checkbox (user will complete this manually)';
            CONTINUE;  -- Skip this question
        -- For dropdown/multiple_choice, get the FIRST valid option from the options array
        ELSIF v_question.question_type IN ('dropdown', 'multiple_choice') AND v_question.options IS NOT NULL THEN
            -- Extract first option from JSON array
            v_first_option := v_question.options::jsonb->>0;
            v_response_value := v_first_option;
        ELSE
            -- Handle other question types
            CASE v_question.question_type
                WHEN 'text' THEN
                    v_response_value := 'Test Response';
                WHEN 'textarea' THEN
                    v_response_value := 'Detailed test response for ' || LEFT(v_question.question_text, 50);
                WHEN 'email' THEN
                    v_file_counter := v_file_counter + 1;
                    v_response_value := 'test' || v_file_counter || '@example.com';
                WHEN 'phone' THEN
                    v_file_counter := v_file_counter + 1;
                    v_response_value := '555-' || LPAD(v_file_counter::text, 3, '0') || '-1234';
                WHEN 'date' THEN
                    v_response_value := '2012-06-15';
                WHEN 'number' THEN
                    v_response_value := '42';
                WHEN 'checkbox' THEN
                    v_response_value := 'true';
                WHEN 'signature' THEN
                    v_response_value := 'Test Signature';

                -- FILE UPLOAD TYPES - Create fake file records
                WHEN 'profile_picture' THEN
                    INSERT INTO files (application_id, uploaded_by, file_name, file_type, file_size, storage_path, section)
                    VALUES (v_app_id, v_user_id, 'camper_photo.jpg', 'image/jpeg', 102400,
                            'test-uploads/' || v_app_id || '/camper_photo.jpg', 'Camper Overview')
                    RETURNING id INTO v_file_id;

                WHEN 'file_upload' THEN
                    v_file_counter := v_file_counter + 1;
                    INSERT INTO files (application_id, uploaded_by, file_name, file_type, file_size, storage_path, section)
                    VALUES (v_app_id, v_user_id,
                            'document_' || v_file_counter || '.pdf',
                            'application/pdf',
                            51200 + (v_file_counter * 1000),
                            'test-uploads/' || v_app_id || '/document_' || v_file_counter || '.pdf',
                            v_question.section_title)
                    RETURNING id INTO v_file_id;

                -- LIST/JSON TYPES with realistic data
                WHEN 'medication_list' THEN
                    v_response_value := '[{"name": "Adderall XR", "dosage": "20mg", "frequency": "Once daily", "purpose": "ADHD"}]';
                WHEN 'allergy_list' THEN
                    v_response_value := '[{"name": "Penicillin", "reaction": "Hives", "severity": "Moderate"}]';
                WHEN 'table' THEN
                    v_response_value := '[{"name": "Dr. Smith", "phone": "555-222-3333", "specialty": "Pediatrics"}]';

                ELSE
                    v_response_value := 'Test Value';
            END CASE;
        END IF;

        -- Insert response
        IF v_file_id IS NOT NULL THEN
            INSERT INTO application_responses (application_id, question_id, response_value, file_id)
            VALUES (v_app_id, v_question.id, v_response_value, v_file_id)
            ON CONFLICT DO NOTHING;
        ELSIF v_response_value IS NOT NULL THEN
            INSERT INTO application_responses (application_id, question_id, response_value)
            VALUES (v_app_id, v_question.id, v_response_value)
            ON CONFLICT DO NOTHING;
        END IF;

    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test Application Created: %', v_app_id;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Camper: % %', v_camper_first_name, v_camper_last_name;
    RAISE NOTICE 'Status: applicant / incomplete (92%%)';
    RAISE NOTICE '';
    RAISE NOTICE 'TO COMPLETE:';
    RAISE NOTICE '1. Open application in frontend as family user';
    RAISE NOTICE '2. Go to "Authorizations" section';
    RAISE NOTICE '3. Check the authorization checkbox';
    RAISE NOTICE '4. This will trigger 100%% completion + email';

END $$;

-- Show what was created (completion_percentage will be 0 until API recalculates)
SELECT
    a.id,
    a.camper_first_name || ' ' || a.camper_last_name AS camper_name,
    a.status,
    a.sub_status,
    a.completion_percentage as stored_completion,
    (SELECT COUNT(*) FROM application_responses WHERE application_id = a.id) AS total_responses,
    (SELECT COUNT(*) FROM files WHERE application_id = a.id) AS file_uploads
FROM applications a
WHERE a.camper_first_name = 'CompletionTest'
ORDER BY a.created_at DESC
LIMIT 1;

-- Show section breakdown with answered counts
SELECT
    s.title,
    (SELECT COUNT(*) FROM application_questions q
     WHERE q.section_id = s.id AND q.is_required = true AND q.is_active = true
     AND (s.required_status IS NULL OR s.required_status = 'applicant')) as required_qs,
    (SELECT COUNT(*) FROM application_responses ar
     JOIN application_questions q ON ar.question_id = q.id
     WHERE q.section_id = s.id AND q.is_required = true AND q.is_active = true
     AND ar.application_id = (SELECT id FROM applications WHERE camper_first_name = 'CompletionTest' ORDER BY created_at DESC LIMIT 1)
     AND (ar.response_value IS NOT NULL OR ar.file_id IS NOT NULL)) as answered
FROM application_sections s
WHERE s.is_active = true
  AND (s.required_status IS NULL OR s.required_status = 'applicant')
ORDER BY s.order_index;
