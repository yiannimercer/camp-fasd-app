-- Template files for application questions
-- Run BEFORE prod_questions.sql

INSERT INTO files (id, application_id, uploaded_by, file_name, file_type, file_size, storage_path, section, created_at) 
VALUES (
    '64397898-71d3-4789-a757-ea9535c9ffb0', 
    NULL, 
    (SELECT id FROM users WHERE email = 'yianni@fasdcamp.org' LIMIT 1), 
    'Health_History_Form_2_W.pdf', 
    'application/pdf', 
    276176, 
    'applications/templates/templates/Health_History_Form_2_W.pdf', 
    'template', 
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO files (id, application_id, uploaded_by, file_name, file_type, file_size, storage_path, section, created_at) 
VALUES (
    'c069c3e2-25ea-4feb-8d7d-22459aa241dc', 
    NULL, 
    (SELECT id FROM users WHERE email = 'yianni@fasdcamp.org' LIMIT 1), 
    'letter_to_my_counselor_and_behavior_policy.pdf', 
    'application/pdf', 
    49532, 
    'applications/templates/templates/letter_to_my_counselor_and_behavior_policy.pdf', 
    'template', 
    NOW()
) ON CONFLICT (id) DO NOTHING;
