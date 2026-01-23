/**
 * API functions for Application Builder (Super Admin)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// CSRF protection header required for state-changing requests
const CSRF_HEADER = {
  'X-Requested-With': 'XMLHttpRequest',
}

export interface Question {
  id: string;
  section_id: string;
  question_text: string;
  question_type: 'text' | 'textarea' | 'dropdown' | 'multiple_choice' | 'file_upload' | 'profile_picture' | 'checkbox' | 'date' | 'email' | 'phone' | 'signature';
  help_text?: string;
  description?: string;
  placeholder?: string;
  is_required: boolean;
  is_active: boolean;
  persist_annually: boolean;  // Keep response during annual reset
  order_index: number;
  options?: string[];
  validation_rules?: {
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    pattern?: string;
    file_types?: string[];
    max_file_size?: number;
  };
  template_file_id?: string | null;
  template_filename?: string | null;
  show_if_question_id?: string | null;
  show_if_answer?: string | null;
  detail_prompt_trigger?: string[] | null;
  detail_prompt_text?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Header {
  id: string;
  section_id: string;
  header_text: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  order_index: number;
  is_active: boolean;
  required_status?: string | null;  // NULL=all, 'applicant'=applicants only, 'camper'=campers only
  created_at: string;
  updated_at: string;
  questions: Question[];
  headers: Header[];
}

export interface SectionCreate {
  title: string;
  description?: string;
  order_index: number;
  is_active?: boolean;
  required_status?: string | null;  // NULL=all, 'applicant', 'camper'
}

export interface SectionUpdate {
  title?: string;
  description?: string;
  order_index?: number;
  is_active?: boolean;
  required_status?: string | null;  // NULL=all, 'applicant', 'camper'
}

export interface QuestionCreate {
  section_id: string;
  question_text: string;
  question_type: string;
  help_text?: string;
  description?: string;
  placeholder?: string;
  is_required?: boolean;
  is_active?: boolean;
  persist_annually?: boolean;
  order_index: number;
  options?: string[];
  validation_rules?: any;
  template_file_id?: string | null;
  show_if_question_id?: string | null;
  show_if_answer?: string | null;
  detail_prompt_trigger?: string[] | null;
  detail_prompt_text?: string | null;
}

export interface QuestionUpdate {
  question_text?: string;
  question_type?: string;
  help_text?: string;
  description?: string;
  placeholder?: string;
  is_required?: boolean;
  is_active?: boolean;
  persist_annually?: boolean;
  order_index?: number;
  options?: string[];
  validation_rules?: any;
  template_file_id?: string | null;
  show_if_question_id?: string | null;
  show_if_answer?: string | null;
  detail_prompt_trigger?: string[] | null;
  detail_prompt_text?: string | null;
}

export interface HeaderCreate {
  section_id: string;
  header_text: string;
  order_index: number;
  is_active?: boolean;
}

export interface HeaderUpdate {
  header_text?: string;
  order_index?: number;
  is_active?: boolean;
}

// Get all sections with questions
export async function getSections(token: string, includeInactive: boolean = false): Promise<Section[]> {
  const response = await fetch(
    `${API_URL}/api/application-builder/sections?include_inactive=${includeInactive}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch sections');
  }

  return response.json();
}

// Create a new section
export async function createSection(token: string, section: SectionCreate): Promise<Section> {
  const response = await fetch(`${API_URL}/api/application-builder/sections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(section),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create section');
  }

  return response.json();
}

// Update a section
export async function updateSection(token: string, sectionId: string, section: SectionUpdate): Promise<Section> {
  const response = await fetch(`${API_URL}/api/application-builder/sections/${sectionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(section),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update section');
  }

  return response.json();
}

// Delete a section
export async function deleteSection(token: string, sectionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/application-builder/sections/${sectionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete section');
  }
}

// Reorder sections
export async function reorderSections(token: string, sectionIds: string[]): Promise<void> {
  const response = await fetch(`${API_URL}/api/application-builder/sections/reorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(sectionIds),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reorder sections');
  }
}

// Create a question
export async function createQuestion(token: string, question: QuestionCreate): Promise<Question> {
  const response = await fetch(`${API_URL}/api/application-builder/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(question),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Create question error:', error);
    throw new Error(JSON.stringify(error.detail) || 'Failed to create question');
  }

  return response.json();
}

// Update a question
export async function updateQuestion(token: string, questionId: string, question: QuestionUpdate): Promise<Question> {
  const response = await fetch(`${API_URL}/api/application-builder/questions/${questionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(question),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Update question error:', error);
    throw new Error(JSON.stringify(error.detail) || 'Failed to update question');
  }

  return response.json();
}

// Delete a question
export async function deleteQuestion(token: string, questionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/application-builder/questions/${questionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete question');
  }
}

// Duplicate a question
export async function duplicateQuestion(token: string, questionId: string): Promise<Question> {
  const response = await fetch(`${API_URL}/api/application-builder/questions/${questionId}/duplicate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to duplicate question');
  }

  return response.json();
}

// Reorder questions
export async function reorderQuestions(token: string, items: { id: string; order_index: number }[]): Promise<void> {
  const response = await fetch(`${API_URL}/api/application-builder/questions/reorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(items),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reorder questions');
  }
}

// Header API functions

// Create a header
export async function createHeader(token: string, header: HeaderCreate): Promise<Header> {
  const response = await fetch(`${API_URL}/api/application-builder/headers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(header),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create header');
  }

  return response.json();
}

// Update a header
export async function updateHeader(token: string, headerId: string, header: HeaderUpdate): Promise<Header> {
  const response = await fetch(`${API_URL}/api/application-builder/headers/${headerId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(header),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update header');
  }

  return response.json();
}

// Delete a header
export async function deleteHeader(token: string, headerId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/application-builder/headers/${headerId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete header');
  }
}

// Reorder headers
export async function reorderHeaders(token: string, items: { id: string; order_index: number }[]): Promise<void> {
  const response = await fetch(`${API_URL}/api/application-builder/headers/reorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(items),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reorder headers');
  }
}
