-- Add medications and allergies tracking tables
-- Migration: 008_add_medications_and_allergies

-- Create medications table
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    strength TEXT,
    dose_amount TEXT,
    dose_form TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create medication_doses table
CREATE TABLE IF NOT EXISTS medication_doses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    given_type TEXT NOT NULL, -- 'At specific time' or 'As needed'
    time TEXT, -- Specific time or 'N/A'
    notes TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create allergies table
CREATE TABLE IF NOT EXISTS allergies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT, -- 'Mild', 'Moderate', 'Severe'
    notes TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_medications_application_id ON medications(application_id);
CREATE INDEX IF NOT EXISTS idx_medications_question_id ON medications(question_id);
CREATE INDEX IF NOT EXISTS idx_medication_doses_medication_id ON medication_doses(medication_id);
CREATE INDEX IF NOT EXISTS idx_allergies_application_id ON allergies(application_id);
CREATE INDEX IF NOT EXISTS idx_allergies_question_id ON allergies(question_id);

-- Add comments for documentation
COMMENT ON TABLE medications IS 'Stores medication information for camper applications';
COMMENT ON TABLE medication_doses IS 'Stores dose schedules for each medication';
COMMENT ON TABLE allergies IS 'Stores allergy information for camper applications';

COMMENT ON COLUMN medications.medication_name IS 'Name of the medication';
COMMENT ON COLUMN medications.strength IS 'Medication strength (e.g., 10mg, 1g)';
COMMENT ON COLUMN medications.dose_amount IS 'Plain English description of dose (e.g., "1 pill two times a day")';
COMMENT ON COLUMN medications.dose_form IS 'Form of medication (Pill, Tablet, Capsule, Liquid, etc.)';
COMMENT ON COLUMN medications.order_index IS 'Order of medications in the list';

COMMENT ON COLUMN medication_doses.given_type IS 'When medication is given: "At specific time" or "As needed"';
COMMENT ON COLUMN medication_doses.time IS 'Specific time medication is given (or N/A if as needed)';
COMMENT ON COLUMN medication_doses.notes IS 'Additional notes for this dose';
COMMENT ON COLUMN medication_doses.order_index IS 'Order of doses for this medication';

COMMENT ON COLUMN allergies.allergen IS 'Name of allergen';
COMMENT ON COLUMN allergies.reaction IS 'Description of allergic reaction';
COMMENT ON COLUMN allergies.severity IS 'Severity level: Mild, Moderate, or Severe';
COMMENT ON COLUMN allergies.notes IS 'Additional notes about the allergy';
COMMENT ON COLUMN allergies.order_index IS 'Order of allergies in the list';
