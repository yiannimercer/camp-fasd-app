/**
 * API client for super admin endpoints
 *
 * Security: All state-changing requests include X-Requested-With header for CSRF protection.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// CSRF protection header required for state-changing requests
const CSRF_HEADER = {
  'X-Requested-With': 'XMLHttpRequest',
}

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
  // User counts
  total_users: number
  total_families: number
  total_admins: number
  total_super_admins: number
  new_users_this_week: number

  // Application totals
  total_applications: number
  applications_this_season: number

  // Applicant stages (status='applicant')
  applicant_not_started: number
  applicant_incomplete: number
  applicant_complete: number
  applicant_under_review: number
  applicant_waitlisted: number

  // Camper stages (status='camper')
  camper_total: number
  camper_incomplete: number
  camper_complete: number
  camper_unpaid: number
  camper_paid: number

  // Inactive stages (status='inactive')
  inactive_withdrawn: number
  inactive_deferred: number
  inactive_deactivated: number

  // Revenue
  total_revenue: number
  season_revenue: number

  // Performance metrics
  avg_completion_days: number | null
  avg_review_days: number | null
}

export interface TeamPerformance {
  team_key: string
  team_name: string
  admin_count: number
  applications_reviewed: number
  avg_review_time_days: number | null
  approval_rate: number | null
}

export interface SystemConfiguration {
  id: string
  key: string
  value: any
  description: string | null
  data_type: string
  category: string
  is_public: boolean
  updated_at: string
  updated_by: string | null
}

export interface EmailTemplate {
  id: string
  key: string
  name: string
  subject: string
  html_content: string
  text_content: string | null
  markdown_content: string | null    // Raw markdown source
  use_markdown: boolean              // Use markdown instead of html_content
  trigger_event: string | null
  variables: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface Team {
  id: string
  key: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  order_index: number
  created_at: string
  updated_at: string
  admin_count?: number
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string | null
  action: string
  actor_id: string | null
  details: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  actor_name?: string | null
  actor_email?: string | null
}

export interface EmailAutomation {
  id: string
  name: string
  description: string | null
  template_key: string
  trigger_type: 'event' | 'scheduled'
  trigger_event: string | null
  schedule_day: number | null
  schedule_hour: number | null
  audience_filter: Record<string, any> | null
  is_active: boolean
  last_sent_at: string | null  // When the scheduled automation last ran
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  template_name?: string | null
  template_subject?: string | null
}

export interface UserWithDetails {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: string
  team: string | null
  status?: string
  receive_emails: boolean
  created_at: string
  last_login: string | null
  camper_name: string | null  // Associated camper name from applications
}

// ============================================================================
// Dashboard APIs
// ============================================================================

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  const response = await fetch(`${API_URL}/api/super-admin/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch dashboard stats')
  }

  return response.json()
}

export async function getTeamPerformance(token: string): Promise<TeamPerformance[]> {
  const response = await fetch(`${API_URL}/api/super-admin/dashboard/team-performance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch team performance')
  }

  return response.json()
}

// ============================================================================
// User Management APIs
// ============================================================================

export async function getAllUsers(
  token: string,
  filters?: {
    role?: string
    status?: string
    team?: string
    search?: string
    skip?: number
    limit?: number
  }
): Promise<UserWithDetails[]> {
  const params = new URLSearchParams()
  if (filters?.role) params.append('role', filters.role)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.team) params.append('team', filters.team)
  if (filters?.search) params.append('search', filters.search)
  if (filters?.skip) params.append('skip', filters.skip.toString())
  if (filters?.limit) params.append('limit', filters.limit.toString())

  const url = `${API_URL}/api/super-admin/users${params.toString() ? '?' + params.toString() : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch users')
  }

  return response.json()
}

export async function updateUser(
  token: string,
  userId: string,
  data: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    role?: string
    team?: string
    status?: string
    receive_emails?: boolean
  }
): Promise<UserWithDetails> {
  const response = await fetch(`${API_URL}/api/super-admin/users/${userId}`, {
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
    throw new Error(error.detail || 'Failed to update user')
  }

  return response.json()
}

export async function changeUserRole(
  token: string,
  userId: string,
  role: string,
  team?: string
): Promise<UserWithDetails> {
  const response = await fetch(`${API_URL}/api/super-admin/users/${userId}/change-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify({ role, team }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to change user role')
  }

  return response.json()
}

export async function suspendUser(
  token: string,
  userId: string,
  status: string,
  reason?: string
): Promise<UserWithDetails> {
  const response = await fetch(`${API_URL}/api/super-admin/users/${userId}/suspend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify({ status, reason }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to suspend user')
  }

  return response.json()
}


// ============================================================================
// ADVANCED USER MANAGEMENT APIs
// ============================================================================

export interface UserActionResult {
  success: boolean
  message: string
  user_id?: string
  error?: string
  details?: Record<string, any>
}

export interface UserDeletionResult {
  success: boolean
  message: string
  summary: {
    supabase_auth_deleted: boolean
    applications_deleted: number
    files_deleted: number
    user_deleted: boolean
    errors: string[]
  }
  error?: string
}

export interface CreateUserRequest {
  email: string
  first_name?: string
  last_name?: string
  role: string
  team?: string
  phone?: string
  send_invitation?: boolean
}

export interface DirectEmailRequest {
  subject: string
  message: string
  include_greeting?: boolean
}

/**
 * Delete a user and all their associated data (cascade delete)
 * This is a DESTRUCTIVE operation that cannot be undone
 */
export async function deleteUser(
  token: string,
  userId: string
): Promise<UserDeletionResult> {
  const response = await fetch(`${API_URL}/api/super-admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete user')
  }

  return response.json()
}

/**
 * Send a password reset email to a user
 */
export async function resetUserPassword(
  token: string,
  userId: string
): Promise<UserActionResult> {
  const response = await fetch(`${API_URL}/api/super-admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to send password reset')
  }

  return response.json()
}

/**
 * Create a new user and send them an invitation email
 */
export async function createUser(
  token: string,
  data: CreateUserRequest
): Promise<UserActionResult> {
  const response = await fetch(`${API_URL}/api/super-admin/users/create`, {
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
    throw new Error(error.detail || 'Failed to create user')
  }

  return response.json()
}

/**
 * Resend an invitation email to a user
 */
export async function resendInvitation(
  token: string,
  userId: string
): Promise<UserActionResult> {
  const response = await fetch(`${API_URL}/api/super-admin/users/${userId}/resend-invitation`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to resend invitation')
  }

  return response.json()
}

/**
 * Send a direct email to a specific user
 */
export async function sendDirectEmail(
  token: string,
  userId: string,
  data: DirectEmailRequest
): Promise<UserActionResult> {
  const response = await fetch(`${API_URL}/api/super-admin/users/${userId}/send-email`, {
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
    throw new Error(error.detail || 'Failed to send email')
  }

  return response.json()
}

// ============================================================================
// System Configuration APIs
// ============================================================================

export async function getAllConfigurations(
  token: string,
  category?: string
): Promise<SystemConfiguration[]> {
  const url = category
    ? `${API_URL}/api/super-admin/config?category=${category}`
    : `${API_URL}/api/super-admin/config`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch configurations')
  }

  return response.json()
}

export async function getConfiguration(
  token: string,
  key: string
): Promise<SystemConfiguration> {
  const response = await fetch(`${API_URL}/api/super-admin/config/${key}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch configuration')
  }

  return response.json()
}

export async function updateConfiguration(
  token: string,
  key: string,
  data: {
    value?: any
    description?: string
    category?: string
    is_public?: boolean
  }
): Promise<SystemConfiguration> {
  const response = await fetch(`${API_URL}/api/super-admin/config/${key}`, {
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
    throw new Error(error.detail || 'Failed to update configuration')
  }

  return response.json()
}

// ============================================================================
// Email Template APIs
// ============================================================================

export async function getAllEmailTemplates(token: string): Promise<EmailTemplate[]> {
  const response = await fetch(`${API_URL}/api/super-admin/email-templates`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch email templates')
  }

  return response.json()
}

export async function getEmailTemplate(
  token: string,
  key: string
): Promise<EmailTemplate> {
  const response = await fetch(`${API_URL}/api/super-admin/email-templates/${key}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch email template')
  }

  return response.json()
}

export async function updateEmailTemplate(
  token: string,
  key: string,
  data: {
    name?: string
    subject?: string
    html_content?: string
    text_content?: string
    markdown_content?: string  // Raw markdown source
    use_markdown?: boolean     // Use markdown instead of html_content
    trigger_event?: string
    variables?: string[]
    is_active?: boolean
  }
): Promise<EmailTemplate> {
  const response = await fetch(`${API_URL}/api/super-admin/email-templates/${key}`, {
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
    throw new Error(error.detail || 'Failed to update email template')
  }

  return response.json()
}

export async function createEmailTemplate(
  token: string,
  data: {
    key: string
    name: string
    subject: string
    html_content: string
    text_content?: string
    markdown_content?: string  // Raw markdown source
    use_markdown?: boolean     // Use markdown instead of html_content
    trigger_event?: string
    variables?: string[]
    is_active?: boolean
  }
): Promise<EmailTemplate> {
  const response = await fetch(`${API_URL}/api/super-admin/email-templates`, {
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
    throw new Error(error.detail || 'Failed to create email template')
  }

  return response.json()
}

// ============================================================================
// Team APIs
// ============================================================================

export async function getAllTeams(token: string): Promise<Team[]> {
  const response = await fetch(`${API_URL}/api/super-admin/teams`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch teams')
  }

  return response.json()
}

export async function createTeam(
  token: string,
  data: {
    key: string
    name: string
    description?: string
    color?: string
    order_index?: number
  }
): Promise<Team> {
  const response = await fetch(`${API_URL}/api/super-admin/teams`, {
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
    throw new Error(error.detail || 'Failed to create team')
  }

  return response.json()
}

export async function updateTeam(
  token: string,
  teamId: string,
  data: {
    name?: string
    description?: string
    color?: string
    is_active?: boolean
    order_index?: number
  }
): Promise<Team> {
  const response = await fetch(`${API_URL}/api/super-admin/teams/${teamId}`, {
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
    throw new Error(error.detail || 'Failed to update team')
  }

  return response.json()
}

// ============================================================================
// Audit Log APIs
// ============================================================================

export async function getAuditLogs(
  token: string,
  filters?: {
    entity_type?: string
    entity_id?: string
    action?: string
    actor_id?: string
    skip?: number
    limit?: number
  }
): Promise<AuditLog[]> {
  const params = new URLSearchParams()
  if (filters?.entity_type) params.append('entity_type', filters.entity_type)
  if (filters?.entity_id) params.append('entity_id', filters.entity_id)
  if (filters?.action) params.append('action', filters.action)
  if (filters?.actor_id) params.append('actor_id', filters.actor_id)
  if (filters?.skip) params.append('skip', filters.skip.toString())
  if (filters?.limit) params.append('limit', filters.limit.toString())

  const url = `${API_URL}/api/super-admin/audit-logs${params.toString() ? '?' + params.toString() : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch audit logs')
  }

  return response.json()
}

// ============================================================================
// Email Automation APIs
// ============================================================================

export async function getAllEmailAutomations(token: string): Promise<EmailAutomation[]> {
  const response = await fetch(`${API_URL}/api/super-admin/email-automations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch email automations')
  }

  return response.json()
}

export async function getEmailAutomation(
  token: string,
  automationId: string
): Promise<EmailAutomation> {
  const response = await fetch(`${API_URL}/api/super-admin/email-automations/${automationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch email automation')
  }

  return response.json()
}

export async function createEmailAutomation(
  token: string,
  data: {
    name: string
    description?: string
    template_key: string
    trigger_type: 'event' | 'scheduled'
    trigger_event?: string
    schedule_day?: number
    schedule_hour?: number
    audience_filter?: Record<string, any>
    is_active?: boolean
  }
): Promise<EmailAutomation> {
  const response = await fetch(`${API_URL}/api/super-admin/email-automations`, {
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
    throw new Error(error.detail || 'Failed to create email automation')
  }

  return response.json()
}

export async function updateEmailAutomation(
  token: string,
  automationId: string,
  data: {
    name?: string
    description?: string
    template_key?: string
    trigger_type?: 'event' | 'scheduled'
    trigger_event?: string
    schedule_day?: number
    schedule_hour?: number
    audience_filter?: Record<string, any>
    is_active?: boolean
  }
): Promise<EmailAutomation> {
  const response = await fetch(`${API_URL}/api/super-admin/email-automations/${automationId}`, {
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
    throw new Error(error.detail || 'Failed to update email automation')
  }

  return response.json()
}

export async function deleteEmailAutomation(
  token: string,
  automationId: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/super-admin/email-automations/${automationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete email automation')
  }
}

// ============================================================================
// Application Deletion API (Super Admin Only)
// ============================================================================

export interface ApplicationDeletionResult {
  success: boolean
  message: string
  summary: {
    application_id: string
    camper_name: string
    status: string
    sub_status: string | null
    user_id: string
    files_deleted: number
    invoices_voided: number
    invoices_already_paid: number
    storage_errors: string[]
  }
}

/**
 * Permanently delete an application and all associated data.
 *
 * This is a DESTRUCTIVE operation that:
 * 1. Voids any open invoices in Stripe (for campers)
 * 2. Deletes all files from Supabase Storage
 * 3. Deletes the application and all related data (CASCADE)
 *
 * This action CANNOT be undone.
 * Only super admins can perform this action.
 */
export async function deleteApplication(
  token: string,
  applicationId: string
): Promise<ApplicationDeletionResult> {
  const response = await fetch(`${API_URL}/api/super-admin/applications/${applicationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete application')
  }

  return response.json()
}


// ============================================================================
// STATUS COLOR CONFIGURATION
// ============================================================================

export interface StatusColorConfig {
  bg: string
  text: string
  label: string
}

export type StatusColorsMap = Record<string, StatusColorConfig>

/**
 * Get status color configuration (requires super admin auth)
 */
export async function getStatusColors(token: string): Promise<StatusColorsMap> {
  const config = await getConfiguration(token, 'status_colors')
  return config.value as StatusColorsMap
}

/**
 * Update status color configuration
 */
export async function updateStatusColors(
  token: string,
  colors: StatusColorsMap
): Promise<SystemConfiguration> {
  return updateConfiguration(token, 'status_colors', { value: colors })
}

/**
 * Get public status colors (no auth required)
 * Used for initial app load before user logs in
 */
export async function getPublicStatusColors(): Promise<StatusColorsMap | null> {
  try {
    const response = await fetch(`${API_URL}/api/public/config/status_colors`)
    if (!response.ok) return null
    const data = await response.json()
    return data.value as StatusColorsMap
  } catch {
    return null
  }
}
