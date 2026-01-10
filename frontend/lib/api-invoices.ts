/**
 * Invoice API Client
 * Functions for invoice management, payments, and scholarships
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// =============================================================================
// Types
// =============================================================================

export interface Invoice {
  id: string
  application_id: string
  stripe_invoice_id?: string
  amount: number
  discount_amount: number
  scholarship_applied: boolean
  scholarship_note?: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  paid_at?: string
  payment_number: number
  total_payments: number
  due_date?: string
  stripe_invoice_url?: string
  voided_at?: string
  voided_reason?: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface PaymentSummary {
  application_id: string
  total_amount: number
  total_paid: number
  total_discount: number
  outstanding_balance: number
  all_paid: boolean
  has_payment_plan: boolean
  invoice_counts: {
    open: number
    paid: number
    voided: number
    total: number
  }
  invoices: Invoice[]
}

export interface PaymentPlanPayment {
  amount: number
  due_date: string // ISO format
}

// =============================================================================
// User Endpoints - View own invoices
// =============================================================================

/**
 * Get all invoices for the current user's applications
 */
export async function getMyInvoices(token: string): Promise<Invoice[]> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/my-invoices`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch invoices')
  }

  return response.json()
}

/**
 * Get invoices for a specific application
 */
export async function getInvoicesForApplication(
  token: string,
  applicationId: string
): Promise<Invoice[]> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/application/${applicationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch invoices')
  }

  return response.json()
}

// =============================================================================
// Admin Endpoints - Invoice Management
// =============================================================================

/**
 * Admin: Get invoices for an application
 */
export async function adminGetInvoices(
  token: string,
  applicationId: string
): Promise<Invoice[]> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/application/${applicationId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch invoices')
  }

  return response.json()
}

/**
 * Admin: Get payment summary for an application
 */
export async function getPaymentSummary(
  token: string,
  applicationId: string
): Promise<PaymentSummary> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/application/${applicationId}/summary`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to fetch payment summary')
  }

  return response.json()
}

/**
 * Admin: Create an invoice manually
 */
export async function createInvoice(
  token: string,
  applicationId: string
): Promise<{
  success: boolean
  invoice_id: string
  stripe_invoice_id: string
  hosted_invoice_url: string
  amount: number
  status: string
  due_date: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/application/${applicationId}/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create invoice')
  }

  return response.json()
}

/**
 * Admin: Apply a scholarship to reduce invoice amount
 */
export async function applyScholarship(
  token: string,
  invoiceId: string,
  scholarshipAmount: number,
  scholarshipNote: string
): Promise<{
  success: boolean
  invoice_id?: string
  stripe_invoice_id?: string
  hosted_invoice_url?: string
  amount?: number
  scholarship_applied?: boolean
  discount_amount?: number
  message?: string
  new_amount?: number
}> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/${invoiceId}/apply-scholarship`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scholarship_amount: scholarshipAmount,
      scholarship_note: scholarshipNote,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to apply scholarship')
  }

  return response.json()
}

/**
 * Admin: Mark an invoice as paid (for offline payments)
 */
export async function markInvoicePaid(
  token: string,
  invoiceId: string,
  note?: string
): Promise<{
  success: boolean
  all_invoices_paid: boolean
}> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/${invoiceId}/mark-paid`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to mark invoice as paid')
  }

  return response.json()
}

/**
 * Admin: Mark a paid invoice as unpaid (for refunds)
 */
export async function markInvoiceUnpaid(
  token: string,
  invoiceId: string,
  reason: string
): Promise<{
  success: boolean
  new_invoice_id?: string
  new_stripe_invoice_id?: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/${invoiceId}/mark-unpaid`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to mark invoice as unpaid')
  }

  return response.json()
}

/**
 * Admin: Void an invoice
 */
export async function voidInvoice(
  token: string,
  invoiceId: string,
  reason: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/${invoiceId}/void`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to void invoice')
  }

  return response.json()
}

/**
 * Admin: Create a payment plan (split invoice into multiple payments)
 */
export async function createPaymentPlan(
  token: string,
  applicationId: string,
  payments: PaymentPlanPayment[]
): Promise<{
  success: boolean
  invoices: Array<{
    id: string
    stripe_invoice_id: string
    amount: number
    payment_number: number
    due_date: string
    hosted_invoice_url: string
  }>
  total_payments: number
}> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/admin/application/${applicationId}/payment-plan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payments }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create payment plan')
  }

  return response.json()
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Get status color for invoice status
 */
export function getInvoiceStatusColor(status: Invoice['status']): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-800'
    case 'open':
      return 'bg-yellow-100 text-yellow-800'
    case 'paid':
      return 'bg-green-100 text-green-800'
    case 'void':
      return 'bg-gray-100 text-gray-500'
    case 'uncollectible':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get display text for invoice status
 */
export function getInvoiceStatusText(status: Invoice['status']): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'open':
      return 'Awaiting Payment'
    case 'paid':
      return 'Paid'
    case 'void':
      return 'Voided'
    case 'uncollectible':
      return 'Uncollectible'
    default:
      return status
  }
}
