'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';

export interface MedicationDose {
  id?: string;
  given_type: string;
  time: string;  // Stores time in HH:MM format (12-hour without AM/PM)
  time_period?: string;  // Stores 'AM' or 'PM'
  notes: string;
  order_index: number;
}

export interface Medication {
  id?: string;
  medication_name: string;
  strength: string;
  dose_amount: string;
  dose_form: string;
  doses: MedicationDose[];
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

interface MedicationListProps {
  questionId: string;
  applicationId: string;
  value: Medication[];
  onChange: (medications: Medication[]) => void;
  medicationFields?: FieldConfig[];
  doseFields?: FieldConfig[];
  isRequired?: boolean;
  noMedications?: boolean;
  onNoMedicationsChange?: (value: boolean) => void;
}

const DEFAULT_MEDICATION_FIELDS: FieldConfig[] = [
  { name: 'medication_name', label: 'Medication', type: 'text', required: true, placeholder: 'e.g., Adderall' },
  { name: 'strength', label: 'Strength', type: 'text', required: true, placeholder: 'e.g., 15mg' },
  { name: 'dose_amount', label: 'Dose Amount', type: 'text', required: true, placeholder: 'e.g., 1 pill two times a day' },
  {
    name: 'dose_form',
    label: 'Dose Form',
    type: 'dropdown',
    required: true,
    options: ['Pill', 'Tablet', 'Capsule', 'Liquid', 'Eye Drop', 'Nasal Spray', 'Inhaler', 'Injection', 'Topical', 'Patch', 'Suppository']
  }
];

const DEFAULT_DOSE_FIELDS: FieldConfig[] = [
  {
    name: 'given_type',
    label: 'Given',
    type: 'dropdown',
    required: true,
    options: ['At specific time', 'As needed']
  },
  { name: 'time', label: 'Time', type: 'text', required: false, placeholder: '12:00' },
  { name: 'notes', label: 'Notes', type: 'textarea', required: false, placeholder: 'Additional instructions...' }
];

// Helper functions for time conversion
const convert24To12Hour = (time24: string): { time12: string; period: string } => {
  if (!time24 || time24 === 'N/A') return { time12: '', period: 'AM' };

  const [hoursStr, minutes] = time24.split(':');
  if (!minutes) return { time12: time24, period: 'AM' };

  let hours = parseInt(hoursStr);
  if (isNaN(hours)) return { time12: time24, period: 'AM' };

  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return { time12: `${hours}:${minutes}`, period };
};

const convert12To24Hour = (time12: string, period: string): string => {
  if (!time12 || time12 === 'N/A') return '';

  const [hoursStr, minutes] = time12.split(':');
  if (!minutes) return time12;

  let hours = parseInt(hoursStr);
  if (isNaN(hours)) return time12;

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};

export default function MedicationList({
  questionId,
  applicationId,
  value,
  onChange,
  medicationFields = DEFAULT_MEDICATION_FIELDS,
  doseFields = DEFAULT_DOSE_FIELDS,
  isRequired = false,
  noMedications = false,
  onNoMedicationsChange
}: MedicationListProps) {
  const [medications, setMedications] = useState<Medication[]>(() => {
    // Initialize with converted 12-hour format times
    const convertedMeds = (value || []).map(med => ({
      ...med,
      doses: (med.doses || []).map(dose => {
        // If time_period is not set, try to convert from 24-hour format
        if (!dose.time_period && dose.time) {
          const { time12, period } = convert24To12Hour(dose.time);
          return {
            ...dose,
            time: time12,
            time_period: period
          };
        }
        return dose;
      })
    }));
    return convertedMeds;
  });
  const [expandedMedications, setExpandedMedications] = useState<Set<number>>(new Set());
  const [savedMedications, setSavedMedications] = useState<Set<number>>(new Set());

  // Sync with parent value changes and convert times to 12-hour format
  // Only update if the value prop has actually changed from external source
  useEffect(() => {
    // Skip if value hasn't changed or is the same as current medications
    if (!value || JSON.stringify(value) === JSON.stringify(medications)) {
      return;
    }

    const convertedMeds = (value || []).map(med => ({
      ...med,
      doses: (med.doses || []).map(dose => {
        // If time_period is not set, try to convert from 24-hour format
        if (!dose.time_period && dose.time) {
          const { time12, period } = convert24To12Hour(dose.time);
          return {
            ...dose,
            time: time12,
            time_period: period
          };
        }
        return dose;
      })
    }));
    setMedications(convertedMeds);
  }, [value]);

  const addMedication = () => {
    const newMedication: Medication = {
      medication_name: '',
      strength: '',
      dose_amount: '',
      dose_form: '',
      doses: [],
      order_index: medications.length
    };
    const updated = [...medications, newMedication];
    setMedications(updated);
    onChange(updated);  // Notify parent of change
    // Auto-expand the new medication
    setExpandedMedications(new Set([...expandedMedications, medications.length]));
  };

  const removeMedication = (index: number) => {
    const updated = medications.filter((_, i) => i !== index);
    // Update order_index for remaining medications
    updated.forEach((med, i) => {
      med.order_index = i;
    });
    setMedications(updated);
    onChange(updated);  // Notify parent of change
    // Remove from expanded set
    const newExpanded = new Set(expandedMedications);
    newExpanded.delete(index);
    setExpandedMedications(newExpanded);
  };

  const updateMedication = (index: number, field: keyof Medication, value: any) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
    onChange(updated);  // Notify parent of change
  };

  const addDose = (medicationIndex: number) => {
    const updated = [...medications];
    const newDose: MedicationDose = {
      given_type: '',
      time: '',
      time_period: 'AM',  // Default to AM
      notes: '',
      order_index: updated[medicationIndex].doses.length
    };
    updated[medicationIndex].doses.push(newDose);
    setMedications(updated);
    onChange(updated);  // Notify parent of change
  };

  const removeDose = (medicationIndex: number, doseIndex: number) => {
    const updated = [...medications];
    updated[medicationIndex].doses = updated[medicationIndex].doses.filter((_, i) => i !== doseIndex);
    // Update order_index for remaining doses
    updated[medicationIndex].doses.forEach((dose, i) => {
      dose.order_index = i;
    });
    setMedications(updated);
    onChange(updated);  // Notify parent of change
  };

  const updateDose = (medicationIndex: number, doseIndex: number, field: string, value: string) => {
    const updated = [...medications];
    updated[medicationIndex].doses[doseIndex] = {
      ...updated[medicationIndex].doses[doseIndex],
      [field]: value
    };
    setMedications(updated);
    onChange(updated);  // Notify parent of change
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedMedications);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMedications(newExpanded);
  };

  const saveMedication = (index: number) => {
    // Trigger parent onChange to ensure save
    onChange(medications);
    // Show saved indicator
    setSavedMedications(prev => new Set([...prev, index]));
    // Clear saved indicator after 2 seconds
    setTimeout(() => {
      setSavedMedications(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }, 2000);
  };

  const validateTimeFormat = (time: string): boolean => {
    if (!time || time.trim() === '' || time.toUpperCase() === 'N/A') return true;
    // Validate 12-hour format HH:MM (1:00 to 12:59)
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]$/;
    return timeRegex.test(time);
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
          rows={2}
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
      {/* No Medications Checkbox */}
      {onNoMedicationsChange && (
        <label className="flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={noMedications}
            onChange={(e) => {
              onNoMedicationsChange(e.target.checked);
              if (e.target.checked) {
                // Clear medications when "no medications" is checked
                setMedications([]);
                onChange([]);
              }
            }}
            className="w-5 h-5 text-camp-green border-2 border-gray-300 rounded focus:ring-camp-green focus:ring-2"
          />
          <span className="text-sm font-medium text-gray-700">
            This camper does not take any medications
          </span>
        </label>
      )}

      {/* Header */}
      {!noMedications && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {medications.length === 0 ? (
              <span>No medications added yet</span>
            ) : (
              <span>{medications.length} medication{medications.length !== 1 ? 's' : ''} listed</span>
            )}
          </div>
          <button
            type="button"
            onClick={addMedication}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-camp-green rounded-lg hover:bg-camp-green/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Medication
          </button>
        </div>
      )}

      {/* Medications List */}
      {!noMedications && (
      <div className="space-y-4">
        {medications.map((medication, medIndex) => (
          <div key={medIndex} className="border-2 border-gray-300 rounded-lg overflow-hidden">
            {/* Medication Header - Expandable */}
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b-2 border-gray-300">
              <button
                type="button"
                onClick={() => toggleExpanded(medIndex)}
                className="flex items-center gap-2 text-left flex-1"
              >
                {expandedMedications.has(medIndex) ? (
                  <ChevronDown className="h-5 w-5 text-gray-600 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-semibold text-gray-900">
                    {medication.medication_name || `Medication ${medIndex + 1}`}
                  </span>
                  {medication.medication_name && medication.strength && (
                    <span className="ml-2 text-sm text-gray-600">({medication.strength})</span>
                  )}
                  {!expandedMedications.has(medIndex) && medication.doses.length > 0 && (
                    <span className="ml-3 text-xs text-gray-500">
                      {medication.doses.length} dose{medication.doses.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => removeMedication(medIndex)}
                className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Remove medication"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Medication Details - Collapsible */}
            {expandedMedications.has(medIndex) && (
              <div className="p-4 space-y-4 bg-white">
                {/* Medication Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medicationFields.map((field) => (
                    <div key={field.name} className={field.name === 'dose_amount' ? 'md:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderFieldInput(
                        field,
                        (medication as any)[field.name] || '',
                        (value) => updateMedication(medIndex, field.name as keyof Medication, value),
                        `med-${medIndex}-${field.name}`
                      )}
                    </div>
                  ))}
                </div>

                {/* Doses Section */}
                <div className="mt-6 pt-6 border-t-2 border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Dose Schedule
                      {medication.doses.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          ({medication.doses.length} dose{medication.doses.length !== 1 ? 's' : ''})
                        </span>
                      )}
                    </h4>
                    <button
                      type="button"
                      onClick={() => addDose(medIndex)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        medication.doses.length === 0
                          ? 'bg-camp-green text-white hover:bg-camp-green/90 shadow-sm'
                          : 'text-camp-green border-2 border-camp-green hover:bg-camp-green hover:text-white'
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      Add Dose
                    </button>
                  </div>

                  {/* Doses Table */}
                  {medication.doses.length === 0 ? (
                    <div className="text-center py-6 text-sm bg-red-50 rounded-lg border-2 border-dashed border-red-300">
                      <p className="text-red-600 font-medium">At least one dose schedule is required</p>
                      <p className="text-red-500 text-xs mt-1">Click "Add Dose" to add a dose schedule</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {medication.doses.map((dose, doseIndex) => (
                        <div
                          key={doseIndex}
                          className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-sm font-medium text-blue-900">
                              Dose {doseIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeDose(medIndex, doseIndex)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                              aria-label="Remove dose"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {doseFields.map((field) => {
                              // Special rendering for time field - supports both dropdown and text+AM/PM modes
                              if (field.name === 'time') {
                                // If time field is configured as dropdown with options, render as simple dropdown
                                if (field.type === 'dropdown' && field.options && field.options.length > 0) {
                                  return (
                                    <div key={field.name}>
                                      <label className="block text-xs font-medium text-blue-900 mb-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </label>
                                      <select
                                        value={dose.time || ''}
                                        onChange={(e) => updateDose(medIndex, doseIndex, 'time', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                                        disabled={dose.given_type === 'As needed'}
                                        required={field.required}
                                      >
                                        <option value="">Select {field.label}</option>
                                        {field.options.map((option, i) => (
                                          <option key={i} value={option}>{option}</option>
                                        ))}
                                      </select>
                                      {dose.given_type === 'As needed' && (
                                        <p className="text-xs text-gray-500 mt-1">N/A for as-needed doses</p>
                                      )}
                                    </div>
                                  );
                                }

                                // Default: render as text input with AM/PM dropdown (legacy behavior)
                                return (
                                  <div key={field.name}>
                                    <label className="block text-xs font-medium text-blue-900 mb-1">
                                      {field.label}
                                      {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={dose.time || ''}
                                        onChange={(e) => updateDose(medIndex, doseIndex, 'time', e.target.value)}
                                        placeholder="8:00"
                                        className={`flex-1 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors ${
                                          dose.time && !validateTimeFormat(dose.time) ? 'border-red-500' : ''
                                        }`}
                                        disabled={dose.given_type === 'As needed'}
                                      />
                                      <select
                                        value={dose.time_period || 'AM'}
                                        onChange={(e) => updateDose(medIndex, doseIndex, 'time_period', e.target.value)}
                                        className="px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                                        disabled={dose.given_type === 'As needed'}
                                      >
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                      </select>
                                    </div>
                                    {dose.time && !validateTimeFormat(dose.time) && (
                                      <p className="text-xs text-red-600 mt-1">
                                        Please use HH:MM format (e.g., 8:00, 12:30)
                                      </p>
                                    )}
                                    {dose.given_type === 'As needed' && (
                                      <p className="text-xs text-gray-500 mt-1">N/A for as-needed doses</p>
                                    )}
                                  </div>
                                );
                              }

                              // Regular rendering for other fields
                              return (
                                <div key={field.name} className={field.name === 'notes' ? 'md:col-span-3' : ''}>
                                  <label className="block text-xs font-medium text-blue-900 mb-1">
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                  </label>
                                  {renderFieldInput(
                                    field,
                                    (dose as any)[field.name] || '',
                                    (value) => updateDose(medIndex, doseIndex, field.name, value),
                                    `dose-${medIndex}-${doseIndex}-${field.name}`
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save Medication Button */}
                <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                  {medication.doses.length === 0 && (
                    <p className="text-sm text-red-600">
                      ⚠ Add at least one dose schedule to complete this medication
                    </p>
                  )}
                  <div className={medication.doses.length === 0 ? '' : 'ml-auto'}>
                    <button
                      type="button"
                      onClick={() => saveMedication(medIndex)}
                      disabled={savedMedications.has(medIndex)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        savedMedications.has(medIndex)
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-camp-green text-white hover:bg-camp-green/90'
                      }`}
                    >
                      {savedMedications.has(medIndex) ? (
                        <>
                          <Check className="h-4 w-4" />
                          Saved!
                        </>
                      ) : (
                        'Save Medication'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Empty State - Only show when there are no medications and "no meds" is not checked */}
      {!noMedications && medications.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <p className="text-gray-600 mb-4">No medications listed</p>
          <p className="text-sm text-gray-500 mb-4">Click the button above to add your first medication</p>
        </div>
      )}

      {/* Confirmed No Medications State */}
      {noMedications && (
        <div className="text-center py-8 border-2 border-green-200 rounded-lg bg-green-50">
          <p className="text-green-700 font-medium">✓ Confirmed: No medications</p>
          <p className="text-sm text-green-600 mt-1">This camper does not take any medications</p>
        </div>
      )}

      {/* Required Field Notice - not shown if "no medications" is checked */}
      {isRequired && !noMedications && medications.length === 0 && (
        <p className="text-sm text-red-600">
          * At least one medication is required, or check "no medications" above
        </p>
      )}
    </div>
  );
}
