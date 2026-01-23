/**
 * API client for email-related endpoints
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// CSRF protection header required for state-changing requests
const CSRF_HEADER = {
  'X-Requested-With': 'XMLHttpRequest',
}

// Types
export interface EmailTemplate {
  id: string
  key: string
  name: string
  subject: string
  html_content: string
  text_content?: string
  markdown_content?: string  // Raw markdown source
  use_markdown?: boolean     // Use markdown instead of html_content
  trigger_event?: string
  variables?: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailDocument {
  id: string
  name: string
  description?: string
  file_name: string
  file_size: number
  file_type: string
  url?: string
  created_at: string
  uploaded_by_name?: string
}

export interface EmailLog {
  id: string
  recipient_email: string
  recipient_name?: string
  subject?: string
  template_used?: string
  email_type?: string
  status?: string
  error_message?: string
  sent_at?: string
  user_id?: string
  application_id?: string
}

export interface EmailQueueItem {
  id: string
  recipient_email: string
  recipient_name?: string
  subject: string
  template_key?: string
  status: string
  priority: number
  attempts: number
  scheduled_for?: string
  created_at: string
  processed_at?: string
  error_message?: string
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
}

export interface EmailConfig {
  enabled: boolean
  from_email: string
  from_name: string
  camp_year: number
  organization_name: string
  organization_website: string
  production_url: string
}

export interface AudienceRecipient {
  email: string
  name: string
  user_id: string
  application_id: string
  status: string
  sub_status: string
  paid_invoice: boolean | null
  camper_name?: string
}

export interface AudienceResponse {
  count: number
  recipients: AudienceRecipient[]
}

export interface SendEmailResponse {
  success: boolean
  resend_id?: string
  error?: string
}

// API Functions

/**
 * Get email configuration
 */
export async function getEmailConfig(token: string): Promise<EmailConfig> {
  const response = await fetch(`${API_URL}/api/emails/config`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch email configuration')
  }

  return response.json()
}

/**
 * Send a test email
 */
export async function sendTestEmail(token: string, toEmail: string): Promise<SendEmailResponse> {
  const response = await fetch(`${API_URL}/api/emails/test?to_email=${encodeURIComponent(toEmail)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to send test email')
  }

  return response.json()
}

/**
 * Send an ad-hoc email from application review
 */
export async function sendAdHocEmail(
  token: string,
  applicationId: string,
  subject: string,
  message: string
): Promise<SendEmailResponse> {
  const response = await fetch(`${API_URL}/api/emails/send-adhoc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify({
      application_id: applicationId,
      subject,
      message,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to send email')
  }

  return response.json()
}

/**
 * Get email audience based on filters
 */
export async function getEmailAudience(
  token: string,
  filters?: {
    status?: string
    sub_status?: string
    paid?: boolean
  }
): Promise<AudienceResponse> {
  const params = new URLSearchParams()
  if (filters?.status) params.append('status_filter', filters.status)
  if (filters?.sub_status) params.append('sub_status_filter', filters.sub_status)
  if (filters?.paid !== undefined) params.append('paid_filter', String(filters.paid))

  const response = await fetch(`${API_URL}/api/emails/audience?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch email audience')
  }

  return response.json()
}

/**
 * Send mass emails
 */
export async function sendMassEmail(
  token: string,
  data: {
    subject: string
    html_content: string
    text_content?: string
    recipients: Array<{
      email: string
      name?: string
      user_id?: string
      application_id?: string
      variables?: Record<string, any>
    }>
    template_key?: string
  }
): Promise<{
  success: boolean
  sent_count: number
  failed_count: number
  message: string
  errors?: Array<{ email: string; error: string }>
}> {
  const response = await fetch(`${API_URL}/api/emails/send-mass`, {
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
    throw new Error(error.detail || 'Failed to send mass emails')
  }

  return response.json()
}

/**
 * Get email logs
 */
export async function getEmailLogs(
  token: string,
  filters?: {
    email_type?: string
    recipient_email?: string
    application_id?: string
    skip?: number
    limit?: number
  }
): Promise<EmailLog[]> {
  const params = new URLSearchParams()
  if (filters?.email_type) params.append('email_type', filters.email_type)
  if (filters?.recipient_email) params.append('recipient_email', filters.recipient_email)
  if (filters?.application_id) params.append('application_id', filters.application_id)
  if (filters?.skip) params.append('skip', String(filters.skip))
  if (filters?.limit) params.append('limit', String(filters.limit))

  const response = await fetch(`${API_URL}/api/emails/logs?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch email logs')
  }

  return response.json()
}

/**
 * Get email log statistics
 */
export async function getEmailLogStats(token: string): Promise<{
  total: number
  sent: number
  failed: number
  last_24h: number
  last_7d: number
}> {
  const response = await fetch(`${API_URL}/api/emails/logs/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch email statistics')
  }

  return response.json()
}

/**
 * Get email queue
 */
export async function getEmailQueue(
  token: string,
  status?: string
): Promise<EmailQueueItem[]> {
  const params = new URLSearchParams()
  if (status) params.append('status_filter', status)

  const response = await fetch(`${API_URL}/api/emails/queue?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch email queue')
  }

  return response.json()
}

/**
 * Get queue statistics
 */
export async function getQueueStats(token: string): Promise<QueueStats> {
  const response = await fetch(`${API_URL}/api/emails/queue/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch queue statistics')
  }

  return response.json()
}

/**
 * Process email queue manually
 */
export async function processQueue(
  token: string,
  batchSize?: number
): Promise<{ success: boolean; processed: number; succeeded: number; failed: number }> {
  const params = new URLSearchParams()
  if (batchSize) params.append('batch_size', String(batchSize))

  const response = await fetch(`${API_URL}/api/emails/queue/process?${params}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to process queue')
  }

  return response.json()
}

/**
 * Cancel a queued email
 */
export async function cancelQueuedEmail(
  token: string,
  emailId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/api/emails/queue/${emailId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to cancel email')
  }

  return response.json()
}

/**
 * Preview an email with CAMP branding
 * Substitutes {{variable}} placeholders with sample data
 *
 * When isMarkdown=true:
 * 1. Variables are substituted in markdown
 * 2. Markdown is converted to styled HTML
 * 3. Result is wrapped in branded template
 */
export async function previewEmail(
  token: string,
  subject: string,
  content: string,
  options?: {
    isMarkdown?: boolean       // Whether content is Markdown
    recipientName?: string
    camperFirstName?: string
    camperLastName?: string
    variables?: Record<string, any>
  }
): Promise<{ subject: string; html: string }> {
  const response = await fetch(`${API_URL}/api/emails/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: JSON.stringify({
      subject,
      content,
      is_markdown: options?.isMarkdown || false,
      recipient_name: options?.recipientName || 'John',
      camper_first_name: options?.camperFirstName || 'Sarah',
      camper_last_name: options?.camperLastName || 'Smith',
      variables: options?.variables,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to generate preview')
  }

  return response.json()
}

/**
 * Preview a specific email template with sample data
 */
export async function previewTemplate(
  token: string,
  templateKey: string,
  firstName?: string,
  camperName?: string
): Promise<{ template_key: string; template_name: string; subject: string; html: string }> {
  const params = new URLSearchParams()
  if (firstName) params.append('first_name', firstName)
  if (camperName) params.append('camper_name', camperName)

  const response = await fetch(`${API_URL}/api/emails/preview/template/${templateKey}?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to preview template')
  }

  return response.json()
}


// ============================================================================
// EMAIL DELIVERABILITY VERIFICATION (User-Facing)
// ============================================================================

export interface DeliverabilityStatus {
  email_deliverability_confirmed: boolean
  email_test_sent_at: string | null
  email_deliverability_confirmed_at: string | null
}

/**
 * Send a test email to verify deliverability (any authenticated user)
 */
export async function sendDeliverabilityTestEmail(token: string): Promise<{
  success: boolean
  error?: string
  message: string
}> {
  const response = await fetch(`${API_URL}/api/emails/deliverability/send-test`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to send test email')
  }

  return response.json()
}

/**
 * Confirm email deliverability (any authenticated user)
 */
export async function confirmEmailDeliverability(token: string): Promise<{
  success: boolean
  message: string
  confirmed_at: string
}> {
  const response = await fetch(`${API_URL}/api/emails/deliverability/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to confirm deliverability')
  }

  return response.json()
}

/**
 * Get email deliverability status (any authenticated user)
 */
export async function getDeliverabilityStatus(token: string): Promise<DeliverabilityStatus> {
  const response = await fetch(`${API_URL}/api/emails/deliverability/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get deliverability status')
  }

  return response.json()
}


// ============================================================================
// EMAIL DOCUMENTS MANAGEMENT
// ============================================================================

/**
 * Get all email documents with signed URLs
 */
export async function getEmailDocuments(token: string): Promise<EmailDocument[]> {
  const response = await fetch(`${API_URL}/api/emails/documents`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch documents')
  }

  return response.json()
}

/**
 * Upload a document for use in email templates
 * Documents are stored in Supabase Storage and can be linked using markdown syntax
 */
export async function uploadEmailDocument(
  token: string,
  file: File,
  name: string,
  description?: string
): Promise<EmailDocument> {
  const formData = new FormData()
  formData.append('file', file)

  const params = new URLSearchParams()
  params.append('name', name)
  if (description) params.append('description', description)

  const response = await fetch(`${API_URL}/api/emails/documents?${params}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to upload document')
  }

  return response.json()
}

/**
 * Delete an email document
 */
export async function deleteEmailDocument(
  token: string,
  documentId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/api/emails/documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete document')
  }

  return response.json()
}

/**
 * Get a fresh signed URL for a document
 * Returns both the URL and a ready-to-use markdown link
 */
export async function getDocumentSignedUrl(
  token: string,
  documentId: string
): Promise<{ document_id: string; name: string; url: string; markdown: string }> {
  const response = await fetch(`${API_URL}/api/emails/documents/${documentId}/url`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get document URL')
  }

  return response.json()
}
