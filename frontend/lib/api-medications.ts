import { Medication, MedicationDose } from '@/components/MedicationList';
import { Allergy } from '@/components/AllergyList';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// CSRF protection header required for state-changing requests
const CSRF_HEADER = {
  'X-Requested-With': 'XMLHttpRequest',
}

// ============================================================================
// MEDICATIONS API
// ============================================================================

export async function getMedicationsForQuestion(
  applicationId: string,
  questionId: string
): Promise<Medication[]> {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `${API_BASE_URL}/api/medications/${applicationId}/question/${questionId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch medications');
  }

  return response.json();
}

export async function saveMedication(medication: Medication): Promise<Medication> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/medications`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER
    },
    body: JSON.stringify(medication)
  });

  if (!response.ok) {
    throw new Error('Failed to save medication');
  }

  return response.json();
}

export async function updateMedication(
  medicationId: string,
  updates: Partial<Medication>
): Promise<Medication> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/medications/${medicationId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error('Failed to update medication');
  }

  return response.json();
}

export async function deleteMedication(medicationId: string): Promise<void> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/medications/${medicationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER
    }
  });

  if (!response.ok) {
    throw new Error('Failed to delete medication');
  }
}

// ============================================================================
// MEDICATION DOSES API
// ============================================================================

export async function saveMedicationDose(
  medicationId: string,
  dose: MedicationDose
): Promise<MedicationDose> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/medications/${medicationId}/doses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER
    },
    body: JSON.stringify(dose)
  });

  if (!response.ok) {
    throw new Error('Failed to save dose');
  }

  return response.json();
}

export async function updateMedicationDose(
  doseId: string,
  updates: Partial<MedicationDose>
): Promise<MedicationDose> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/doses/${doseId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error('Failed to update dose');
  }

  return response.json();
}

export async function deleteMedicationDose(doseId: string): Promise<void> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/doses/${doseId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER
    }
  });

  if (!response.ok) {
    throw new Error('Failed to delete dose');
  }
}

// ============================================================================
// ALLERGIES API
// ============================================================================

export async function getAllergiesForQuestion(
  applicationId: string,
  questionId: string
): Promise<Allergy[]> {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `${API_BASE_URL}/api/allergies/${applicationId}/question/${questionId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch allergies');
  }

  return response.json();
}

export async function saveAllergy(allergy: Allergy): Promise<Allergy> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/allergies`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER
    },
    body: JSON.stringify(allergy)
  });

  if (!response.ok) {
    throw new Error('Failed to save allergy');
  }

  return response.json();
}

export async function updateAllergy(
  allergyId: string,
  updates: Partial<Allergy>
): Promise<Allergy> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/allergies/${allergyId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error('Failed to update allergy');
  }

  return response.json();
}

export async function deleteAllergy(allergyId: string): Promise<void> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/allergies/${allergyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER
    }
  });

  if (!response.ok) {
    throw new Error('Failed to delete allergy');
  }
}

// ============================================================================
// BULK SAVE HELPERS
// ============================================================================

/**
 * Save all medications for a question at once
 * This handles creating new medications and updating existing ones
 */
export async function saveMedicationsForQuestion(
  applicationId: string,
  questionId: string,
  medications: Medication[]
): Promise<void> {
  // First, fetch existing medications to see what needs to be created vs updated
  const existing = await getMedicationsForQuestion(applicationId, questionId);
  const existingIds = new Set(existing.map(m => m.id));

  for (const medication of medications) {
    const medData = {
      ...medication,
      application_id: applicationId,
      question_id: questionId
    };

    if (medication.id && existingIds.has(medication.id)) {
      // Update existing
      await updateMedication(medication.id, medData);
    } else {
      // Create new
      await saveMedication(medData);
    }
  }

  // Delete medications that were removed
  const currentIds = new Set(medications.filter(m => m.id).map(m => m.id));
  for (const existingMed of existing) {
    if (existingMed.id && !currentIds.has(existingMed.id)) {
      await deleteMedication(existingMed.id);
    }
  }
}

/**
 * Save all allergies for a question at once
 * This handles creating new allergies and updating existing ones
 */
export async function saveAllergiesForQuestion(
  applicationId: string,
  questionId: string,
  allergies: Allergy[]
): Promise<void> {
  // First, fetch existing allergies to see what needs to be created vs updated
  const existing = await getAllergiesForQuestion(applicationId, questionId);
  const existingIds = new Set(existing.map(a => a.id));

  for (const allergy of allergies) {
    const allergyData = {
      ...allergy,
      application_id: applicationId,
      question_id: questionId
    };

    if (allergy.id && existingIds.has(allergy.id)) {
      // Update existing
      await updateAllergy(allergy.id, allergyData);
    } else {
      // Create new
      await saveAllergy(allergyData);
    }
  }

  // Delete allergies that were removed
  const currentIds = new Set(allergies.filter(a => a.id).map(a => a.id));
  for (const existingAllergy of existing) {
    if (existingAllergy.id && !currentIds.has(existingAllergy.id)) {
      await deleteAllergy(existingAllergy.id);
    }
  }
}
