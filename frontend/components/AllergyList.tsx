'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface Allergy {
  id?: string;
  allergen: string;
  reaction: string;
  severity: string;
  notes: string;
  order_index: number;
}

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'dropdown';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface AllergyListProps {
  questionId: string;
  applicationId: string;
  value: Allergy[];
  onChange: (allergies: Allergy[]) => void;
  allergyFields?: FieldConfig[];
  isRequired?: boolean;
  noAllergies?: boolean;
  onNoAllergiesChange?: (value: boolean) => void;
}

const DEFAULT_ALLERGY_FIELDS: FieldConfig[] = [
  { name: 'allergen', label: 'Allergen', type: 'text', required: true, placeholder: 'e.g., Peanuts, Penicillin' },
  { name: 'reaction', label: 'Reaction', type: 'text', required: true, placeholder: 'e.g., Hives, difficulty breathing' },
  {
    name: 'severity',
    label: 'Severity',
    type: 'dropdown',
    required: true,
    options: ['Mild', 'Moderate', 'Severe']
  },
  { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false, placeholder: 'Any additional information...' }
];

export default function AllergyList({
  questionId,
  applicationId,
  value,
  onChange,
  allergyFields = DEFAULT_ALLERGY_FIELDS,
  isRequired = false,
  noAllergies = false,
  onNoAllergiesChange
}: AllergyListProps) {
  const [allergies, setAllergies] = useState<Allergy[]>(value || []);

  // Sync with parent when allergies change
  useEffect(() => {
    onChange(allergies);
  }, [allergies]);

  // Sync with parent value changes
  useEffect(() => {
    setAllergies(value || []);
  }, [value]);

  const addAllergy = () => {
    const newAllergy: Allergy = {
      allergen: '',
      reaction: '',
      severity: '',
      notes: '',
      order_index: allergies.length
    };
    setAllergies([...allergies, newAllergy]);
  };

  const removeAllergy = (index: number) => {
    const updated = allergies.filter((_, i) => i !== index);
    // Update order_index for remaining allergies
    updated.forEach((allergy, i) => {
      allergy.order_index = i;
    });
    setAllergies(updated);
  };

  const updateAllergy = (index: number, field: keyof Allergy, value: string) => {
    const updated = [...allergies];
    updated[index] = { ...updated[index], [field]: value };
    setAllergies(updated);
  };

  const renderFieldInput = (
    field: FieldConfig,
    value: string,
    onChange: (value: string) => void,
    fieldKey: string
  ) => {
    const baseClasses = "w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors";

    if (field.type === 'dropdown' && field.options) {
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
        >
          <option value="">Select {field.label}</option>
          {field.options.map((option, i) => (
            <option key={i} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${baseClasses} resize-y`}
          required={field.required}
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={baseClasses}
        required={field.required}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* No Allergies Checkbox */}
      {onNoAllergiesChange && (
        <label className="flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={noAllergies}
            onChange={(e) => {
              onNoAllergiesChange(e.target.checked);
              if (e.target.checked) {
                // Clear allergies when "no allergies" is checked
                setAllergies([]);
                onChange([]);
              }
            }}
            className="w-5 h-5 text-camp-green border-2 border-gray-300 rounded focus:ring-camp-green focus:ring-2"
          />
          <span className="text-sm font-medium text-gray-700">
            This camper has no known allergies
          </span>
        </label>
      )}

      {/* Header */}
      {!noAllergies && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {allergies.length === 0 ? (
              <span>No allergies added yet</span>
            ) : (
              <span>{allergies.length} allerg{allergies.length !== 1 ? 'ies' : 'y'} listed</span>
            )}
          </div>
          <button
            type="button"
            onClick={addAllergy}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-camp-green rounded-lg hover:bg-camp-green/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Allergy
          </button>
        </div>
      )}

      {/* Allergies List */}
      {!noAllergies && (
      <div className="space-y-4">
        {allergies.map((allergy, index) => (
          <div key={index} className="p-4 border-2 border-gray-300 rounded-lg bg-white">
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900">
                {allergy.allergen || `Allergy ${index + 1}`}
                {allergy.severity && (
                  <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                    allergy.severity === 'Severe' ? 'bg-red-100 text-red-800' :
                    allergy.severity === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {allergy.severity}
                  </span>
                )}
              </h4>
              <button
                type="button"
                onClick={() => removeAllergy(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Remove allergy"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allergyFields.map((field) => (
                <div key={field.name} className={field.name === 'notes' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderFieldInput(
                    field,
                    (allergy as any)[field.name] || '',
                    (value) => updateAllergy(index, field.name as keyof Allergy, value),
                    `allergy-${index}-${field.name}`
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Empty State - Only show when there are no allergies and "no allergies" is not checked */}
      {!noAllergies && allergies.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <p className="text-gray-600 mb-4">No allergies listed</p>
          <p className="text-sm text-gray-500 mb-4">Click the button above to add your first allergy</p>
        </div>
      )}

      {/* Confirmed No Allergies State */}
      {noAllergies && (
        <div className="text-center py-8 border-2 border-green-200 rounded-lg bg-green-50">
          <p className="text-green-700 font-medium">✓ Confirmed: No known allergies</p>
          <p className="text-sm text-green-600 mt-1">This camper has no known allergies</p>
        </div>
      )}

      {/* Required Field Notice - not shown if "no allergies" is checked */}
      {isRequired && !noAllergies && allergies.length === 0 && (
        <p className="text-sm text-red-600">
          * At least one allergy is required, or check "no known allergies" above
        </p>
      )}
    </div>
  );
}
