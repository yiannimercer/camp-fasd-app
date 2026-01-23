/**
 * API client for application-related endpoints
 *
 * Security: All state-changing requests include X-Requested-With header for CSRF protection.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// CSRF protection header required for state-changing requests
const CSRF_HEADER = {
  'X-Requested-With': 'XMLHttpRequest',
}

// Types
// Section header for grouping questions within a section
export interface SectionHeader {
  id: string
  section_id: string
  header_text: string
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ApplicationSection {
  id: string
  title: string
  description: string | null
  order_index: number
  is_active: boolean
  visible_before_acceptance: boolean
  required_status: string | null   // NULL=all, 'applicant'=applicant only, 'camper'=camper only
  score_calculation_type: string | null  // e.g., 'fasd_best' for FASD BeST score calculation
  created_at: string
  updated_at: string
  questions: ApplicationQuestion[]
  headers: SectionHeader[]  // Section sub-headers for grouping questions
}

export interface ApplicationQuestion {
  id: string
  section_id: string
  question_text: string
  question_type: string
  options: string[] | Record<string, any> | null  // Can be array or object
  is_required: boolean
  reset_annually: boolean
  order_index: number
  validation_rules: any[] | Record<string, any> | null  // Can be array or object
  help_text: string | null
  description: string | null
  placeholder: string | null
  template_file_id?: string | null
  is_active: boolean
  show_if_question_id?: string | null
  show_if_answer?: string | null
  detail_prompt_trigger?: string[] | null
  detail_prompt_text?: string | null
  header_text?: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  user_id: string
  camper_first_name: string | null
  camper_last_name: string | null
  status: string  // applicant, camper, inactive
  sub_status: string  // not_started, incomplete, completed, under_review, waitlist, complete, deferred, withdrawn, rejected
  completion_percentage: number
  is_returning_camper: boolean
  cabin_assignment: string | null
  // Payment tracking
  paid_invoice: boolean | null  // NULL=no invoice, false=unpaid, true=paid
  stripe_invoice_id: string | null
  // Profile photo (pre-signed URL for camper photo if uploaded)
  profile_photo_url: string | null
  // Timestamps
  created_at: string
  updated_at: string
  completed_at: string | null  // When application reached 100%
  under_review_at: string | null  // When first admin action received
  promoted_to_camper_at: string | null  // When promoted to camper status
  waitlisted_at: string | null
  deferred_at: string | null
  withdrawn_at: string | null
  rejected_at: string | null
  paid_at: string | null
}

export interface ApplicationResponse {
  question_id: string
  response_value?: string
  file_id?: string
}

export interface ApplicationWithResponses extends Application {
  responses: ApplicationResponse[]
}

export interface SectionProgress {
  section_id: string
  section_title: string
  total_questions: number
  required_questions: number
  answered_questions: number
  answered_required: number
  completion_percentage: number
  is_complete: boolean
}

export interface ApplicationProgress {
  application_id: string
  total_sections: number
  completed_sections: number
  overall_percentage: number
  section_progress: SectionProgress[]
}

/**
 * Get all application sections with questions
 * Optionally filter by application status (for conditional questions)
 */
export async function getApplicationSections(token: string, applicationId?: string): Promise<ApplicationSection[]> {
  const url = applicationId
    ? `${API_URL}/api/applications/sections?application_id=${applicationId}`
    : `${API_URL}/api/applications/sections`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch application sections')
  }

  return response.json()
}

/**
 * Create a new application
 */
export async function createApplication(
  token: string,
  data: { camper_first_name?: string; camper_last_name?: string }
): Promise<Application> {
  const response = await fetch(`${API_URL}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create application')
  }

  return response.json()
}

/**
 * Get user's applications
 */
export async function getMyApplications(token: string): Promise<Application[]> {
  const response = await fetch(`${API_URL}/api/applications`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch applications')
  }

  return response.json()
}

/**
 * Get a specific application with responses
 */
export async function getApplication(token: string, applicationId: string): Promise<ApplicationWithResponses> {
  const response = await fetch(`${API_URL}/api/applications/${applicationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch application')
  }

  return response.json()
}

/**
 * Update application (autosave)
 */
export async function updateApplication(
  token: string,
  applicationId: string,
  data: {
    camper_first_name?: string
    camper_last_name?: string
    responses?: ApplicationResponse[]
  }
): Promise<Application> {
  const response = await fetch(`${API_URL}/api/applications/${applicationId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to update application')
  }

  return response.json()
}

/**
 * Get application progress
 */
export async function getApplicationProgress(
  token: string,
  applicationId: string
): Promise<ApplicationProgress> {
  const response = await fetch(`${API_URL}/api/applications/${applicationId}/progress`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch application progress')
  }

  return response.json()
}

/**
 * Reactivate a deactivated application
 * Sets status back to 'applicant' and determines appropriate sub_status
 * based on current response state (not_started, incomplete, or complete)
 */
export async function reactivateApplication(
  token: string,
  applicationId: string
): Promise<Application> {
  const response = await fetch(`${API_URL}/api/applications/${applicationId}/reactivate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to reactivate application')
  }

  return response.json()
}

/**
 * Withdraw an application (family-initiated)
 * Sets status to inactive with sub_status 'withdrawn'
 */
export async function withdrawApplication(
  token: string,
  applicationId: string
): Promise<{
  message: string
  application_id: string
  status: string
  sub_status: string
  withdrawn_at: string
}> {
  const response = await fetch(`${API_URL}/api/applications/${applicationId}/withdraw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to withdraw application')
  }

  return response.json()
}

