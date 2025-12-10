/**
 * Admin Actions API Client
 * Functions for admin workflow: approve, deny, and notes
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AdminInfo {
  id: string
  first_name?: string
  last_name?: string
  email: string
  team?: string
}

export interface AdminNote {
  id: string
  application_id: string
  admin_id: string
  admin?: AdminInfo
  note: string
  created_at: string
  updated_at: string
}

export interface CreateNoteRequest {
  note: string
}

/**
 * Create a new admin note on an application
 */
export async function createAdminNote(
  token: string,
  applicationId: string,
  noteData: CreateNoteRequest
): Promise<AdminNote> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(noteData),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create note')
  }

  return response.json()
}

/**
 * Get all notes for an application
 */
export async function getAdminNotes(
  token: string,
  applicationId: string
): Promise<AdminNote[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/notes`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch notes')
  }

  return response.json()
}

/**
 * Approve an application
 */
export async function approveApplication(
  token: string,
  applicationId: string
): Promise<{ message: string; application_id: string; status: string; approval_count: number; auto_accepted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to approve application')
  }

  return response.json()
}

/**
 * Decline an application
 */
export async function declineApplication(
  token: string,
  applicationId: string
): Promise<{ message: string; application_id: string; status: string; approval_count: number; decline_count: number }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/decline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to decline application')
  }

  return response.json()
}

/**
 * Get approval status for an application
 */
export async function getApprovalStatus(
  token: string,
  applicationId: string
): Promise<{
  application_id: string
  approval_count: number
  decline_count: number
  current_user_vote: string | null
  approved_by: Array<{ admin_id: string; name: string; team: string | null }>
  declined_by: Array<{ admin_id: string; name: string; team: string | null }>
  status: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/approval-status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch approval status')
  }

  return response.json()
}

/**
 * Accept an application (legacy - redirects to promoteToTier2)
 * Kept for backwards compatibility
 */
export async function acceptApplication(
  token: string,
  applicationId: string
): Promise<{
  message: string
  application_id: string
  tier: number
  status: string
  promoted_at: string
  approved_by_teams: string[]
  new_completion_percentage: number
}> {
  return promoteToTier2(token, applicationId)
}

/**
 * Promote an application from Tier 1 to Tier 2
 * Requires 3 approvals from 3 different teams
 */
export async function promoteToTier2(
  token: string,
  applicationId: string
): Promise<{
  message: string
  application_id: string
  tier: number
  status: string
  promoted_at: string
  approved_by_teams: string[]
  new_completion_percentage: number
}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/promote-to-tier2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to promote application')
  }

  return response.json()
}

/**
 * Add an application to the waitlist
 * Can only be called from 'under_review' status
 */
export async function addToWaitlist(
  token: string,
  applicationId: string
): Promise<{
  message: string
  application_id: string
  status: string
  waitlisted_at: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/waitlist`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to add to waitlist')
  }

  return response.json()
}

/**
 * Remove an application from the waitlist
 * @param action - 'promote' to promote to Tier 2, 'return_review' to return to under_review
 */
export async function removeFromWaitlist(
  token: string,
  applicationId: string,
  action: 'promote' | 'return_review'
): Promise<{
  message: string
  application_id: string
  status: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/remove-from-waitlist?action=${action}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to remove from waitlist')
  }

  return response.json()
}

/**
 * Defer an application to next year
 */
export async function deferApplication(
  token: string,
  applicationId: string
): Promise<{
  message: string
  application_id: string
  status: string
  deferred_at: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/defer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to defer application')
  }

  return response.json()
}

/**
 * Withdraw an application
 */
export async function withdrawApplication(
  token: string,
  applicationId: string
): Promise<{
  message: string
  application_id: string
  status: string
  withdrawn_at: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/withdraw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to withdraw application')
  }

  return response.json()
}

/**
 * Reject an application
 * Can only be done from Tier 1 statuses
 */
export async function rejectApplication(
  token: string,
  applicationId: string
): Promise<{
  message: string
  application_id: string
  status: string
  rejected_at: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/admin/applications/${applicationId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to reject application')
  }

  return response.json()
}
