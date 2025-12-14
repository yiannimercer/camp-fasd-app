/**
 * Admin API Client
 * Functions for admin-only operations
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface UserInfo {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
}

export interface ApplicationWithUser {
  id: string
  user_id: string
  user?: UserInfo
  camper_first_name?: string
  camper_last_name?: string
  status: string  // applicant, camper, inactive
  sub_status: string  // not_started, incomplete, completed, under_review, waitlist, complete, deferred, withdrawn, rejected
  completion_percentage: number
  is_returning_camper: boolean
  cabin_assignment?: string
  // Camper metadata
  camper_age?: number
  camper_gender?: string
  tuition_status?: string
  // Payment tracking
  paid_invoice?: boolean | null  // NULL=no invoice, false=unpaid, true=paid
  stripe_invoice_id?: string | null
  // Timestamps
  created_at: string
  updated_at: string
  completed_at?: string  // When applicant reached 100%
  under_review_at?: string  // When first admin action received
  promoted_to_camper_at?: string  // When promoted to camper status
  waitlisted_at?: string  // When moved to waitlist
  deferred_at?: string  // When deferred
  withdrawn_at?: string  // When withdrawn
  rejected_at?: string  // When rejected
  paid_at?: string  // When payment received
  // Admin info
  approval_count?: number
  approved_by_teams?: string[]
  responses?: Array<{
    id: string
    question_id: string
    response_value?: string
    file_id?: string
  }>
}

/**
 * Get all applications (admin only)
 */
export async function getAllApplications(
  token: string,
  statusFilter?: string,
  search?: string
): Promise<ApplicationWithUser[]> {
  const params = new URLSearchParams()
  if (statusFilter) params.append('status_filter', statusFilter)
  if (search) params.append('search', search)

  const url = `${API_URL}/api/applications/admin/all${params.toString() ? `?${params.toString()}` : ''}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to fetch applications')
  }

  return response.json()
}

/**
 * Get a specific application (admin only)
 */
export async function getApplicationAdmin(
  token: string,
  applicationId: string
): Promise<ApplicationWithUser> {
  const response = await fetch(`${API_URL}/api/applications/admin/${applicationId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to fetch application')
  }

  return response.json()
}

/**
 * Update an application (admin only)
 */
export async function updateApplicationAdmin(
  token: string,
  applicationId: string,
  data: {
    camper_first_name?: string
    camper_last_name?: string
    responses?: Array<{
      question_id: string
      response_value?: string
      file_id?: string
    }>
  }
): Promise<ApplicationWithUser> {
  const response = await fetch(`${API_URL}/api/admin/applications/${applicationId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to update application')
  }

  return response.json()
}

/**
 * Get application progress (admin only)
 */
export async function getApplicationProgressAdmin(
  token: string,
  applicationId: string
): Promise<import('./api-applications').ApplicationProgress> {
  const response = await fetch(`${API_URL}/api/admin/applications/${applicationId}/progress`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to fetch application progress')
  }

  return response.json()
}
