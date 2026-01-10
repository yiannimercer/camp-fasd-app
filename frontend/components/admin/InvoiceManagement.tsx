/**
 * InvoiceManagement - Admin panel for managing application invoices
 *
 * Features:
 * - View all invoices for an application
 * - Payment summary (total, paid, outstanding)
 * - Apply scholarships
 * - Create payment plans
 * - Mark paid/unpaid
 * - Void invoices
 */

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { formatDateCST } from '@/lib/date-utils'
import {
  DollarSign,
  CreditCard,
  Gift,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
  Plus,
  Divide,
  Loader2,
} from 'lucide-react'
import {
  Invoice,
  PaymentSummary,
  getPaymentSummary,
  applyScholarship,
  markInvoicePaid,
  markInvoiceUnpaid,
  voidInvoice,
  createPaymentPlan,
  createInvoice,
  formatCurrency,
  getInvoiceStatusColor,
  getInvoiceStatusText,
} from '@/lib/api-invoices'

interface InvoiceManagementProps {
  applicationId: string
  applicationStatus: string
  onPaymentUpdate?: () => void
}

export default function InvoiceManagement({
  applicationId,
  applicationStatus,
  onPaymentUpdate,
}: InvoiceManagementProps) {
  const { token } = useAuth()
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showScholarshipModal, setShowScholarshipModal] = useState(false)
  const [showPaymentPlanModal, setShowPaymentPlanModal] = useState(false)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false)
  const [showMarkUnpaidModal, setShowMarkUnpaidModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Form states
  const [scholarshipAmount, setScholarshipAmount] = useState('')
  const [scholarshipNote, setScholarshipNote] = useState('')
  const [voidReason, setVoidReason] = useState('')
  const [unpaidReason, setUnpaidReason] = useState('')
  const [paidNote, setPaidNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Payment plan state
  const [paymentPlanPayments, setPaymentPlanPayments] = useState<Array<{ amount: string; due_date: string }>>([
    { amount: '', due_date: '' },
    { amount: '', due_date: '' },
  ])

  const loadSummary = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const data = await getPaymentSummary(token, applicationId)
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [applicationId, token])

  const handleApplyScholarship = async () => {
    if (!token || !selectedInvoice) return
    setActionLoading(true)

    try {
      const amount = parseFloat(scholarshipAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid scholarship amount')
      }

      await applyScholarship(token, selectedInvoice.id, amount, scholarshipNote)
      setShowScholarshipModal(false)
      setScholarshipAmount('')
      setScholarshipNote('')
      setSelectedInvoice(null)
      await loadSummary()
      onPaymentUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply scholarship')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!token || !selectedInvoice) return
    setActionLoading(true)

    try {
      await markInvoicePaid(token, selectedInvoice.id, paidNote)
      setShowMarkPaidModal(false)
      setPaidNote('')
      setSelectedInvoice(null)
      await loadSummary()
      onPaymentUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkUnpaid = async () => {
    if (!token || !selectedInvoice) return
    setActionLoading(true)

    try {
      await markInvoiceUnpaid(token, selectedInvoice.id, unpaidReason)
      setShowMarkUnpaidModal(false)
      setUnpaidReason('')
      setSelectedInvoice(null)
      await loadSummary()
      onPaymentUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as unpaid')
    } finally {
      setActionLoading(false)
    }
  }

  const handleVoid = async () => {
    if (!token || !selectedInvoice) return
    setActionLoading(true)

    try {
      await voidInvoice(token, selectedInvoice.id, voidReason)
      setShowVoidModal(false)
      setVoidReason('')
      setSelectedInvoice(null)
      await loadSummary()
      onPaymentUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to void invoice')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreatePaymentPlan = async () => {
    if (!token) return
    setActionLoading(true)

    try {
      const payments = paymentPlanPayments.map((p) => ({
        amount: parseFloat(p.amount),
        due_date: new Date(p.due_date).toISOString(),
      }))

      if (payments.some((p) => isNaN(p.amount) || p.amount <= 0)) {
        throw new Error('Please enter valid amounts for all payments')
      }

      await createPaymentPlan(token, applicationId, payments)
      setShowPaymentPlanModal(false)
      setPaymentPlanPayments([
        { amount: '', due_date: '' },
        { amount: '', due_date: '' },
      ])
      await loadSummary()
      onPaymentUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment plan')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateInvoice = async () => {
    if (!token) return
    setActionLoading(true)

    try {
      await createInvoice(token, applicationId)
      await loadSummary()
      onPaymentUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setActionLoading(false)
    }
  }

  const addPaymentPlanRow = () => {
    setPaymentPlanPayments([...paymentPlanPayments, { amount: '', due_date: '' }])
  }

  const removePaymentPlanRow = (index: number) => {
    if (paymentPlanPayments.length > 2) {
      setPaymentPlanPayments(paymentPlanPayments.filter((_, i) => i !== index))
    }
  }

  const updatePaymentPlanRow = (index: number, field: 'amount' | 'due_date', value: string) => {
    const updated = [...paymentPlanPayments]
    updated[index][field] = value
    setPaymentPlanPayments(updated)
  }

  // Don't show for non-camper applications
  if (applicationStatus !== 'camper') {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-camp-green mr-2" />
          <span className="text-gray-600">Loading payment information...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadSummary}
          className="mt-4 px-4 py-2 bg-camp-green text-white rounded-lg hover:bg-camp-green/90"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!summary) {
    return null
  }

  const openInvoice = summary.invoices.find((inv) => inv.status === 'open')

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Payment & Invoices</h3>
            <p className="text-sm text-gray-500">Manage tuition and payment plans</p>
          </div>
        </div>
        <button
          onClick={loadSummary}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Payment Summary */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4 bg-gray-50 border-b border-gray-200">
        <div className="text-center">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.total_amount)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Total Paid</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(summary.total_paid)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Discounts</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.total_discount)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className={`text-lg font-bold ${summary.outstanding_balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {formatCurrency(summary.outstanding_balance)}
          </p>
        </div>
      </div>

      {/* Status Banner */}
      {summary.all_paid && (
        <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">All invoices paid</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-6 py-4 flex flex-wrap gap-3 border-b border-gray-200">
        {openInvoice && (
          <>
            <button
              onClick={() => {
                setSelectedInvoice(openInvoice)
                setShowScholarshipModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Gift className="h-4 w-4" />
              Apply Scholarship
            </button>

            <button
              onClick={() => {
                // Pre-fill with equal split of current amount
                const totalAmount = openInvoice.amount
                const equalAmount = (totalAmount / 2).toFixed(2)
                const today = new Date()
                const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
                const twoMonths = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate())

                setPaymentPlanPayments([
                  { amount: equalAmount, due_date: nextMonth.toISOString().split('T')[0] },
                  { amount: equalAmount, due_date: twoMonths.toISOString().split('T')[0] },
                ])
                setShowPaymentPlanModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Divide className="h-4 w-4" />
              Create Payment Plan
            </button>

            <button
              onClick={() => {
                setSelectedInvoice(openInvoice)
                setShowMarkPaidModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Mark as Paid
            </button>

            <button
              onClick={() => {
                setSelectedInvoice(openInvoice)
                setShowVoidModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Void Invoice
            </button>
          </>
        )}

        {summary.invoices.length === 0 && (
          <button
            onClick={handleCreateInvoice}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-camp-green text-white rounded-lg hover:bg-camp-green/90 transition-colors disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Invoice
          </button>
        )}
      </div>

      {/* Invoice List */}
      <div className="divide-y divide-gray-100">
        {summary.invoices.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No invoices yet</p>
          </div>
        ) : (
          summary.invoices.map((invoice) => (
            <div key={invoice.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getInvoiceStatusColor(invoice.status)}`}>
                      {getInvoiceStatusText(invoice.status)}
                    </span>
                    {invoice.total_payments > 1 && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        Payment {invoice.payment_number} of {invoice.total_payments}
                      </span>
                    )}
                    {invoice.scholarship_applied && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        Scholarship Applied
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(invoice.amount)}</p>

                  {invoice.discount_amount > 0 && (
                    <p className="text-sm text-blue-600">Discount: {formatCurrency(invoice.discount_amount)}</p>
                  )}

                  {invoice.description && <p className="text-sm text-gray-600 mt-1">{invoice.description}</p>}

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {invoice.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {formatDateCST(invoice.due_date)}
                      </span>
                    )}
                    {invoice.paid_at && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Paid: {formatDateCST(invoice.paid_at)}
                      </span>
                    )}
                    {invoice.voided_at && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <XCircle className="h-3 w-3" />
                        Voided: {formatDateCST(invoice.voided_at)}
                      </span>
                    )}
                  </div>

                  {invoice.scholarship_note && (
                    <p className="mt-2 text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded">
                      Scholarship: {invoice.scholarship_note}
                    </p>
                  )}

                  {invoice.voided_reason && (
                    <p className="mt-2 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded">
                      Void reason: {invoice.voided_reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {invoice.stripe_invoice_url && invoice.status === 'open' && (
                    <a
                      href={invoice.stripe_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-camp-green text-white rounded-lg hover:bg-camp-green/90"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Pay Now
                    </a>
                  )}

                  {invoice.status === 'paid' && (
                    <button
                      onClick={() => {
                        setSelectedInvoice(invoice)
                        setShowMarkUnpaidModal(true)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Mark Unpaid
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Scholarship Modal */}
      {showScholarshipModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Apply Scholarship</h3>
            <p className="text-sm text-gray-600 mb-4">
              Current invoice: {formatCurrency(selectedInvoice.amount)}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scholarship Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={scholarshipAmount}
                    onChange={(e) => setScholarshipAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                {scholarshipAmount && parseFloat(scholarshipAmount) >= selectedInvoice.amount && (
                  <p className="mt-1 text-sm text-blue-600">
                    Full scholarship - payment will not be required
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scholarship Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={scholarshipNote}
                  onChange={(e) => setScholarshipNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                  rows={2}
                  placeholder="Explain the scholarship..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowScholarshipModal(false)
                  setScholarshipAmount('')
                  setScholarshipNote('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyScholarship}
                disabled={actionLoading || !scholarshipAmount || !scholarshipNote}
                className="px-4 py-2 bg-camp-green text-white rounded-lg hover:bg-camp-green/90 disabled:opacity-50"
              >
                {actionLoading ? 'Applying...' : 'Apply Scholarship'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Plan Modal */}
      {showPaymentPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create Payment Plan</h3>
            <p className="text-sm text-gray-600 mb-4">
              Split the invoice into multiple payments. Total must equal the current invoice amount.
            </p>

            <div className="space-y-3">
              {paymentPlanPayments.map((payment, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={payment.amount}
                      onChange={(e) => updatePaymentPlanRow(index, 'amount', e.target.value)}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                      placeholder="Amount"
                    />
                  </div>
                  <input
                    type="date"
                    value={payment.due_date}
                    onChange={(e) => updatePaymentPlanRow(index, 'due_date', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                  />
                  {paymentPlanPayments.length > 2 && (
                    <button
                      onClick={() => removePaymentPlanRow(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addPaymentPlanRow}
              className="mt-3 text-sm text-camp-green hover:underline flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Payment
            </button>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Plan Total:{' '}
                <span className="font-semibold">
                  {formatCurrency(
                    paymentPlanPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                  )}
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPaymentPlanModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePaymentPlan}
                disabled={actionLoading}
                className="px-4 py-2 bg-camp-green text-white rounded-lg hover:bg-camp-green/90 disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Payment Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {showMarkPaidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Mark Invoice as Paid</h3>
            <p className="text-sm text-gray-600 mb-4">
              Mark this {formatCurrency(selectedInvoice.amount)} invoice as paid? This is for recording
              payments made outside of Stripe (cash, check, etc.).
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optional)
              </label>
              <textarea
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                rows={2}
                placeholder="Payment method, check number, etc."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMarkPaidModal(false)
                  setPaidNote('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Unpaid Modal */}
      {showMarkUnpaidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Mark Invoice as Unpaid</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will void the current invoice and create a new open invoice for the same amount.
              Use this for refunds or payment corrections.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={unpaidReason}
                onChange={(e) => setUnpaidReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                rows={2}
                placeholder="Explain why this is being marked unpaid..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMarkUnpaidModal(false)
                  setUnpaidReason('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkUnpaid}
                disabled={actionLoading || !unpaidReason}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Mark as Unpaid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {showVoidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Void Invoice</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently void the invoice. This action cannot be undone.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                rows={2}
                placeholder="Explain why this invoice is being voided..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowVoidModal(false)
                  setVoidReason('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={actionLoading || !voidReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Voiding...' : 'Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
