/**
 * AdminActionPanel - Floating slide-out panel for admin actions
 *
 * Provides always-accessible admin controls while reviewing applications:
 * - Approval/Decline with required notes
 * - View and add team notes
 * - Application metadata quick view
 * - Approval status and history
 */

'use client'

import { useState, useEffect } from 'react'
import { formatDateCST } from '@/lib/date-utils'
import { useTeamColors } from '@/lib/contexts/TeamColorsContext'
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Clock,
  AlertCircle,
  Send,
  Mail,
  DollarSign,
  CreditCard,
  Gift,
  Divide,
  Trash2,
  ExternalLink,
  RefreshCw,
  Plus,
  Loader2,
  Calendar,
  CalendarX,
  UserCheck
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
import { useAuth } from '@/lib/contexts/AuthContext'

interface AdminNote {
  id: string
  note: string
  created_at: string
  admin?: {
    first_name?: string
    last_name?: string
    team?: string
  }
}

interface ApprovalStatus {
  approval_count: number
  decline_count: number
  current_user_vote: string | null
  approved_by: Array<{ admin_id: string; name: string; team: string | null; note?: string }>
  declined_by: Array<{ admin_id: string; name: string; team: string | null; note?: string }>
}

interface ApplicationMeta {
  id: string
  status: string
  sub_status?: string
  completion_percentage: number
  created_at: string
  updated_at: string
  completed_at?: string
  is_returning_camper: boolean
  cabin_assignment?: string
}

interface AdminActionPanelProps {
  applicationId: string
  applicationMeta: ApplicationMeta
  approvalStatus: ApprovalStatus | null
  notes: AdminNote[]
  onApprove: (note: string) => Promise<void>
  onDecline: (note: string) => Promise<void>
  onAddNote: (note: string) => Promise<void>
  onDefer?: () => Promise<void>  // Defer application (available when decline_count >= 1)
  onAccept?: () => Promise<void>  // Accept/promote application (available when approval_count >= 3)
  onEmailClick?: () => void
  onDeleteClick?: () => void  // Super admin delete handler
  camperName?: string
  isLoading?: boolean
  isSuperAdmin?: boolean  // Whether current user is super admin
  // Optional controlled mode props
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function AdminActionPanel({
  applicationId,
  applicationMeta,
  approvalStatus,
  notes,
  onApprove,
  onDecline,
  onAddNote,
  onDefer,
  onAccept,
  onEmailClick,
  onDeleteClick,
  camperName,
  isLoading = false,
  isSuperAdmin = false,
  isOpen: controlledIsOpen,
  onOpenChange
}: AdminActionPanelProps) {
  const { getTeamColor, getTeamStyle } = useTeamColors()
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open)
    }
    setInternalIsOpen(open)
  }
  const [activeTab, setActiveTab] = useState<'approval' | 'notes' | 'meta' | 'payment'>('approval')
  const [actionNote, setActionNote] = useState('')
  const [newNote, setNewNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [noteLoading, setNoteLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Final decision state (Accept/Defer)
  const [finalActionLoading, setFinalActionLoading] = useState(false)
  const [showDeferConfirm, setShowDeferConfirm] = useState(false)

  // Payment state
  const { token } = useAuth()
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentActionLoading, setPaymentActionLoading] = useState(false)

  // Payment modals
  const [showScholarshipModal, setShowScholarshipModal] = useState(false)
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false)
  const [showMarkUnpaidModal, setShowMarkUnpaidModal] = useState(false)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [showPaymentPlanModal, setShowPaymentPlanModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Payment form state
  const [scholarshipAmount, setScholarshipAmount] = useState('')
  const [scholarshipNote, setScholarshipNote] = useState('')
  const [scholarshipMode, setScholarshipMode] = useState<'deduct' | 'set'>('deduct')
  const [voidReason, setVoidReason] = useState('')
  const [unpaidReason, setUnpaidReason] = useState('')
  const [paidNote, setPaidNote] = useState('')
  const [paymentPlanPayments, setPaymentPlanPayments] = useState<Array<{ amount: string; due_date: string }>>([
    { amount: '', due_date: '' },
    { amount: '', due_date: '' },
  ])

  // Load payment summary when payment tab is active
  const loadPaymentSummary = async () => {
    if (!token || applicationMeta.status !== 'camper') return
    setPaymentLoading(true)
    setPaymentError(null)
    try {
      const data = await getPaymentSummary(token, applicationId)
      setPaymentSummary(data)
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to load payment info')
    } finally {
      setPaymentLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'payment' && applicationMeta.status === 'camper' && !paymentSummary && !paymentLoading) {
      loadPaymentSummary()
    }
  }, [activeTab, applicationMeta.status, token])

  // Payment action handlers
  const handleApplyScholarship = async () => {
    if (!token || !selectedInvoice) return
    setPaymentActionLoading(true)
    try {
      const inputAmount = parseFloat(scholarshipAmount)
      if (isNaN(inputAmount) || inputAmount < 0) throw new Error('Invalid amount')

      // Calculate the actual deduction amount based on mode
      let deductionAmount: number
      if (scholarshipMode === 'deduct') {
        // Deduct mode: input IS the deduction amount
        deductionAmount = inputAmount
        if (deductionAmount > selectedInvoice.amount) {
          throw new Error('Scholarship amount cannot exceed invoice amount')
        }
      } else {
        // Set mode: input is the NEW total, calculate deduction
        if (inputAmount > selectedInvoice.amount) {
          throw new Error('New amount cannot be greater than current invoice')
        }
        deductionAmount = selectedInvoice.amount - inputAmount
      }

      if (deductionAmount <= 0) throw new Error('Scholarship must reduce the invoice amount')

      await applyScholarship(token, selectedInvoice.id, deductionAmount, scholarshipNote)
      setShowScholarshipModal(false)
      setScholarshipAmount('')
      setScholarshipNote('')
      setScholarshipMode('deduct')
      setSelectedInvoice(null)
      await loadPaymentSummary()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to apply scholarship')
    } finally {
      setPaymentActionLoading(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!token || !selectedInvoice) return
    setPaymentActionLoading(true)
    try {
      await markInvoicePaid(token, selectedInvoice.id, paidNote)
      setShowMarkPaidModal(false)
      setPaidNote('')
      setSelectedInvoice(null)
      await loadPaymentSummary()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to mark paid')
    } finally {
      setPaymentActionLoading(false)
    }
  }

  const handleMarkUnpaid = async () => {
    if (!token || !selectedInvoice) return
    setPaymentActionLoading(true)
    try {
      await markInvoiceUnpaid(token, selectedInvoice.id, unpaidReason)
      setShowMarkUnpaidModal(false)
      setUnpaidReason('')
      setSelectedInvoice(null)
      await loadPaymentSummary()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to mark unpaid')
    } finally {
      setPaymentActionLoading(false)
    }
  }

  const handleVoid = async () => {
    if (!token || !selectedInvoice) return
    setPaymentActionLoading(true)
    try {
      await voidInvoice(token, selectedInvoice.id, voidReason)
      setShowVoidModal(false)
      setVoidReason('')
      setSelectedInvoice(null)
      await loadPaymentSummary()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to void invoice')
    } finally {
      setPaymentActionLoading(false)
    }
  }

  const handleCreateInvoice = async () => {
    if (!token) return
    setPaymentActionLoading(true)
    try {
      await createInvoice(token, applicationId)
      await loadPaymentSummary()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setPaymentActionLoading(false)
    }
  }

  const handleCreatePaymentPlan = async () => {
    if (!token) return
    setPaymentActionLoading(true)
    try {
      const payments = paymentPlanPayments.map((p) => ({
        amount: parseFloat(p.amount),
        due_date: new Date(p.due_date).toISOString(),
      }))
      if (payments.some((p) => isNaN(p.amount) || p.amount <= 0)) {
        throw new Error('Invalid payment amounts')
      }
      await createPaymentPlan(token, applicationId, payments)
      setShowPaymentPlanModal(false)
      setPaymentPlanPayments([{ amount: '', due_date: '' }, { amount: '', due_date: '' }])
      await loadPaymentSummary()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to create payment plan')
    } finally {
      setPaymentActionLoading(false)
    }
  }

  // Handle approval with required note
  const handleApprove = async () => {
    if (!actionNote.trim()) {
      setActionError('Please add a note explaining your approval decision')
      return
    }
    setActionError(null)
    setActionLoading(true)
    try {
      await onApprove(actionNote)
      setActionNote('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle decline with required note
  const handleDecline = async () => {
    if (!actionNote.trim()) {
      setActionError('Please add a note explaining your decline decision')
      return
    }
    setActionError(null)
    setActionLoading(true)
    try {
      await onDecline(actionNote)
      setActionNote('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to decline')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle adding a general note
  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setNoteLoading(true)
    try {
      await onAddNote(newNote)
      setNewNote('')
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setNoteLoading(false)
    }
  }

  // Handle defer (when 1+ declines exist)
  const handleDefer = async () => {
    if (!onDefer) return
    setFinalActionLoading(true)
    try {
      await onDefer()
      setShowDeferConfirm(false)
    } catch (err) {
      console.error('Failed to defer:', err)
    } finally {
      setFinalActionLoading(false)
    }
  }

  // Handle accept (when 3+ approvals exist)
  const handleAccept = async () => {
    if (!onAccept) return
    setFinalActionLoading(true)
    try {
      await onAccept()
    } catch (err) {
      console.error('Failed to accept:', err)
    } finally {
      setFinalActionLoading(false)
    }
  }

  const formatStatus = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applicant': return 'bg-blue-100 text-blue-800'
      case 'camper': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <>
      {/* Toggle Button - Always visible on right edge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 px-3 py-4 bg-camp-green text-white rounded-l-lg shadow-lg hover:bg-camp-green/90 transition-all duration-300 ${
          isOpen ? 'translate-x-[420px]' : ''
        }`}
        title={isOpen ? 'Close admin panel' : 'Open admin panel'}
      >
        {isOpen ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <>
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium writing-mode-vertical rotate-180" style={{ writingMode: 'vertical-rl' }}>
              Admin Actions
            </span>
            {approvalStatus && (
              <span className="absolute -top-2 -left-2 bg-amber-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {approvalStatus.approval_count}/3
              </span>
            )}
          </>
        )}
      </button>

      {/* Slide-out Panel */}
      <div
        className={`fixed right-0 top-[104px] h-[calc(100vh-104px)] w-[420px] bg-white shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="bg-gradient-to-r from-camp-green to-camp-green/80 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Admin Panel</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Status */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(applicationMeta.status)}`}>
              {formatStatus(applicationMeta.status)}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-16 h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${applicationMeta.completion_percentage}%` }}
                />
              </div>
              <span className="text-white/90">{applicationMeta.completion_percentage}%</span>
            </span>
          </div>

          {/* Email Family Button - Always visible */}
          {onEmailClick && (
            <button
              onClick={onEmailClick}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors border border-white/30"
            >
              <Mail className="h-4 w-4" />
              <span>Email Family</span>
              {camperName && (
                <span className="text-white/70 text-xs truncate max-w-[120px]">({camperName})</span>
              )}
            </button>
          )}

          {/* Delete Application Button - Super Admin Only */}
          {isSuperAdmin && onDeleteClick && (
            <button
              onClick={onDeleteClick}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/40 text-red-100 font-medium rounded-lg transition-colors border border-red-400/50"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Application</span>
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('approval')}
            className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'approval'
                ? 'text-camp-green border-b-2 border-camp-green bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Approval</span>
              {approvalStatus && (
                <span className="bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                  {approvalStatus.approval_count}/3
                </span>
              )}
            </div>
          </button>
          {/* Payment Tab - Only for campers */}
          {applicationMeta.status === 'camper' && (
            <button
              onClick={() => setActiveTab('payment')}
              className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'payment'
                  ? 'text-camp-green border-b-2 border-camp-green bg-green-50/50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Payment</span>
                {paymentSummary && paymentSummary.outstanding_balance > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                    Due
                  </span>
                )}
                {paymentSummary && paymentSummary.all_paid && (
                  <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">
                    ✓
                  </span>
                )}
              </div>
            </button>
          )}
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'notes'
                ? 'text-camp-green border-b-2 border-camp-green bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
              {notes.length > 0 && (
                <span className="bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                  {notes.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('meta')}
            className={`flex-1 px-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'meta'
                ? 'text-camp-green border-b-2 border-camp-green bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Details</span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto h-[calc(100vh-180px)] p-4">
          {/* Approval Tab */}
          {activeTab === 'approval' && (
            <div className="space-y-6">
              {/* Current Approval Status */}
              {approvalStatus && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Approval Progress
                  </h3>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        approvalStatus.approval_count >= 3 ? 'bg-green-500' : 'bg-camp-green'
                      }`}
                      style={{ width: `${Math.min((approvalStatus.approval_count / 3) * 100, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-green-600 font-medium">
                      {approvalStatus.approval_count} Approved
                    </span>
                    {approvalStatus.decline_count > 0 && (
                      <span className="text-red-600 font-medium">
                        {approvalStatus.decline_count} Declined
                      </span>
                    )}
                  </div>

                  {/* Who approved */}
                  {approvalStatus.approved_by.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase">Approved by:</p>
                      {approvalStatus.approved_by.map((admin) => {
                        const teamColor = admin.team ? getTeamColor(admin.team) : null
                        return (
                          <div key={admin.admin_id} className="flex items-start gap-2 bg-green-50 rounded p-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-green-800">
                                {admin.name}
                                {teamColor && (
                                  <span
                                    className="ml-1 text-xs px-1.5 py-0.5 rounded"
                                    style={getTeamStyle(admin.team)}
                                  >
                                    {teamColor.name}
                                  </span>
                                )}
                              </p>
                              {admin.note && (
                                <p className="text-xs text-green-700 mt-1 italic">"{admin.note}"</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Who declined */}
                  {approvalStatus.declined_by.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase">Declined by:</p>
                      {approvalStatus.declined_by.map((admin) => {
                        const teamColor = admin.team ? getTeamColor(admin.team) : null
                        return (
                          <div key={admin.admin_id} className="flex items-start gap-2 bg-red-50 rounded p-2">
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-red-800">
                                {admin.name}
                                {teamColor && (
                                  <span
                                    className="ml-1 text-xs px-1.5 py-0.5 rounded"
                                    style={getTeamStyle(admin.team)}
                                  >
                                    {teamColor.name}
                                  </span>
                                )}
                              </p>
                              {admin.note && (
                                <p className="text-xs text-red-700 mt-1 italic">"{admin.note}"</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Your Decision */}
              <div className="bg-white rounded-lg border-2 border-camp-green/20 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Decision</h3>

                {approvalStatus?.current_user_vote ? (
                  <div className={`p-3 rounded-lg ${
                    approvalStatus.current_user_vote === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <p className="font-medium flex items-center gap-2">
                      {approvalStatus.current_user_vote === 'approved' ? (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          You approved this application
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5" />
                          You declined this application
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Required Note */}
                    <div className="mb-4">
                      <label className="block text-sm text-gray-600 mb-2">
                        Decision Note <span className="text-red-500">*</span>
                        <span className="text-xs text-gray-400 ml-1">(required)</span>
                      </label>
                      <textarea
                        value={actionNote}
                        onChange={(e) => {
                          setActionNote(e.target.value)
                          setActionError(null)
                        }}
                        placeholder="Explain your decision... (e.g., 'Medical forms reviewed and complete' or 'Missing required documentation')"
                        className={`w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-camp-green focus:border-transparent ${
                          actionError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        rows={3}
                        disabled={actionLoading}
                      />
                      {actionError && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {actionError}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {actionLoading ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={handleDecline}
                        disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        {actionLoading ? 'Processing...' : 'Decline'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Final Decision Section - Shows Accept/Defer based on approval status */}
              {approvalStatus && applicationMeta.status === 'applicant' && (
                (approvalStatus.approval_count >= 3 || approvalStatus.decline_count >= 1) && (
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Final Decision
                    </h3>

                    {/* Context message */}
                    <div className="text-xs text-slate-600 mb-4 bg-white/60 rounded-lg p-3 border border-slate-200">
                      {approvalStatus.approval_count >= 3 && approvalStatus.decline_count >= 1 ? (
                        <p>
                          This application has <span className="font-semibold text-green-700">{approvalStatus.approval_count} approvals</span> and{' '}
                          <span className="font-semibold text-red-700">{approvalStatus.decline_count} decline{approvalStatus.decline_count > 1 ? 's' : ''}</span>.
                          You may accept or defer this application.
                        </p>
                      ) : approvalStatus.approval_count >= 3 ? (
                        <p>
                          This application has received <span className="font-semibold text-green-700">{approvalStatus.approval_count} approvals</span> from different teams.
                          Ready to accept!
                        </p>
                      ) : (
                        <p>
                          This application has <span className="font-semibold text-red-700">{approvalStatus.decline_count} decline{approvalStatus.decline_count > 1 ? 's' : ''}</span>.
                          You may defer this application to next year.
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      {/* Accept Button - Shows when 3+ approvals */}
                      {approvalStatus.approval_count >= 3 && onAccept && (
                        <button
                          onClick={handleAccept}
                          disabled={finalActionLoading}
                          className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <UserCheck className="h-5 w-5" />
                          {finalActionLoading ? 'Processing...' : 'Accept as Camper'}
                        </button>
                      )}

                      {/* Defer Button - Shows when 1+ declines */}
                      {approvalStatus.decline_count >= 1 && onDefer && (
                        <button
                          onClick={() => setShowDeferConfirm(true)}
                          disabled={finalActionLoading}
                          className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CalendarX className="h-5 w-5" />
                          {finalActionLoading ? 'Processing...' : 'Defer to Next Year'}
                        </button>
                      )}
                    </div>

                    {/* Defer Confirmation Modal */}
                    {showDeferConfirm && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <CalendarX className="h-5 w-5" />
                              Confirm Deferral
                            </h3>
                          </div>
                          <div className="p-6">
                            <p className="text-slate-700 mb-4">
                              Are you sure you want to <span className="font-semibold text-amber-700">defer this application</span>?
                            </p>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                              <p className="text-sm text-amber-800">
                                <strong>What this means:</strong>
                              </p>
                              <ul className="mt-2 text-sm text-amber-700 space-y-1 list-disc list-inside">
                                <li>Application moves to <strong>Inactive → Deferred</strong> status</li>
                                <li>Family can reapply next year</li>
                                <li>This action cannot be easily undone</li>
                              </ul>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setShowDeferConfirm(false)}
                                disabled={finalActionLoading}
                                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleDefer}
                                disabled={finalActionLoading}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                              >
                                {finalActionLoading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deferring...
                                  </>
                                ) : (
                                  <>
                                    <CalendarX className="h-4 w-4" />
                                    Yes, Defer
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add Note Form */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add a Note
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  General notes for the team (follow-up calls, updated info, observations)
                </p>
                <div className="flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Type your note..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-camp-green focus:border-transparent"
                    rows={2}
                    disabled={noteLoading}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={noteLoading || !newNote.trim()}
                    className="px-3 py-2 bg-camp-green hover:bg-camp-green/90 text-white rounded-lg transition-colors disabled:opacity-50 self-end"
                    title="Add note"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Team Notes ({notes.length})
                </h3>

                {notes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notes yet</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-camp-green rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {note.admin?.first_name?.[0]}{note.admin?.last_name?.[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {note.admin?.first_name} {note.admin?.last_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {note.admin?.team && (
                              <span
                                className="px-1.5 py-0.5 rounded font-medium"
                                style={getTeamStyle(note.admin.team)}
                              >
                                {getTeamColor(note.admin.team).name}
                              </span>
                            )}
                            <span>{formatDateCST(note.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap pl-10">{note.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Payment Tab */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              {paymentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-camp-green mr-2" />
                  <span className="text-gray-600">Loading payment info...</span>
                </div>
              ) : paymentError ? (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>{paymentError}</span>
                  </div>
                  <button
                    onClick={loadPaymentSummary}
                    className="px-4 py-2 bg-camp-green text-white rounded-lg hover:bg-camp-green/90"
                  >
                    Retry
                  </button>
                </div>
              ) : paymentSummary ? (
                <>
                  {/* Payment Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Payment Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-bold text-gray-900">{formatCurrency(paymentSummary.total_amount)}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">Paid</p>
                        <p className="font-bold text-green-600">{formatCurrency(paymentSummary.total_paid)}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">Discount</p>
                        <p className="font-bold text-blue-600">{formatCurrency(paymentSummary.total_discount)}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">Outstanding</p>
                        <p className={`font-bold ${paymentSummary.outstanding_balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {formatCurrency(paymentSummary.outstanding_balance)}
                        </p>
                      </div>
                    </div>

                    {paymentSummary.all_paid && (
                      <div className="mt-3 flex items-center gap-2 bg-green-50 text-green-800 p-2 rounded">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">All invoices paid!</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {(() => {
                    const openInvoice = paymentSummary.invoices.find(inv => inv.status === 'open')
                    return (
                      <div className="flex flex-wrap gap-2">
                        {openInvoice && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedInvoice(openInvoice)
                                setShowScholarshipModal(true)
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium"
                            >
                              <Gift className="h-3 w-3" />
                              Scholarship
                            </button>
                            <button
                              onClick={() => {
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
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-xs font-medium"
                            >
                              <Divide className="h-3 w-3" />
                              Split
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInvoice(openInvoice)
                                setShowMarkPaidModal(true)
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-xs font-medium"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Mark Paid
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInvoice(openInvoice)
                                setShowVoidModal(true)
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-xs font-medium"
                            >
                              <Trash2 className="h-3 w-3" />
                              Void
                            </button>
                          </>
                        )}
                        {paymentSummary.invoices.length === 0 && (
                          <button
                            onClick={handleCreateInvoice}
                            disabled={paymentActionLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-camp-green text-white rounded-lg hover:bg-camp-green/90 disabled:opacity-50"
                          >
                            {paymentActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Create Invoice
                          </button>
                        )}
                      </div>
                    )
                  })()}

                  {/* Invoice List */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Invoices ({paymentSummary.invoices.length})
                    </h3>
                    {paymentSummary.invoices.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No invoices yet</p>
                      </div>
                    ) : (
                      paymentSummary.invoices.map((invoice) => (
                        <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getInvoiceStatusColor(invoice.status)}`}>
                              {getInvoiceStatusText(invoice.status)}
                            </span>
                            <span className="font-bold text-gray-900">{formatCurrency(invoice.amount)}</span>
                          </div>
                          {invoice.total_payments > 1 && (
                            <p className="text-xs text-purple-600 mb-1">
                              Payment {invoice.payment_number} of {invoice.total_payments}
                            </p>
                          )}
                          {invoice.scholarship_applied && (
                            <p className="text-xs text-blue-600 mb-1">
                              Scholarship: -{formatCurrency(invoice.discount_amount)}
                            </p>
                          )}
                          {invoice.due_date && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {formatDateCST(invoice.due_date)}
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            {invoice.stripe_invoice_url && invoice.status === 'open' && (
                              <a
                                href={invoice.stripe_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-camp-green text-white rounded hover:bg-camp-green/90"
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
                      ))
                    )}
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={loadPaymentSummary}
                    disabled={paymentLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${paymentLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Payment info not available</p>
                  <button
                    onClick={loadPaymentSummary}
                    className="mt-2 px-4 py-2 text-sm text-camp-green hover:underline"
                  >
                    Load Payment Info
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Metadata Tab */}
          {activeTab === 'meta' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Application Details
                </h3>

                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Application ID</dt>
                    <dd className="font-mono text-xs text-gray-700 truncate max-w-[180px]" title={applicationMeta.id}>
                      {applicationMeta.id}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(applicationMeta.status)}`}>
                        {formatStatus(applicationMeta.status)}
                      </span>
                    </dd>
                  </div>
                  {applicationMeta.sub_status && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Stage</dt>
                      <dd className="text-gray-700">{formatStatus(applicationMeta.sub_status)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Progress</dt>
                    <dd className="text-gray-700 font-medium">{applicationMeta.completion_percentage}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Returning Camper</dt>
                    <dd className="text-gray-700">{applicationMeta.is_returning_camper ? 'Yes' : 'No'}</dd>
                  </div>
                  {applicationMeta.cabin_assignment && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Cabin</dt>
                      <dd className="text-gray-700">{applicationMeta.cabin_assignment}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline
                </h3>

                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Created</dt>
                    <dd className="text-gray-700">{formatDateCST(applicationMeta.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Last Updated</dt>
                    <dd className="text-gray-700">{formatDateCST(applicationMeta.updated_at)}</dd>
                  </div>
                  {applicationMeta.completed_at && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Completed</dt>
                      <dd className="text-gray-700">{formatDateCST(applicationMeta.completed_at)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay when panel is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Payment Modals */}
      {/* Scholarship Modal - Enhanced with Mode Selection */}
      {showScholarshipModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Apply Scholarship</h3>
                  <p className="text-blue-100 text-sm">Adjust invoice amount</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Current Amount Display */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-1">Current Invoice</p>
                <p className="text-3xl font-bold text-gray-900 tabular-nums">
                  {formatCurrency(selectedInvoice.amount)}
                </p>
              </div>

              {/* Mode Toggle - Segmented Control */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to apply the scholarship?</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => { setScholarshipMode('deduct'); setScholarshipAmount(''); }}
                    className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      scholarshipMode === 'deduct'
                        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="block">Deduct Amount</span>
                    <span className="text-xs opacity-70">Subtract from total</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScholarshipMode('set'); setScholarshipAmount(''); }}
                    className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      scholarshipMode === 'set'
                        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="block">Set New Total</span>
                    <span className="text-xs opacity-70">Set exact amount</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {scholarshipMode === 'deduct' ? 'Scholarship Amount' : 'New Invoice Total'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={scholarshipMode === 'set' ? selectedInvoice.amount : undefined}
                    value={scholarshipAmount}
                    onChange={(e) => setScholarshipAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg tabular-nums"
                    placeholder={scholarshipMode === 'deduct' ? 'Amount to deduct...' : 'New total amount...'}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {scholarshipMode === 'deduct'
                    ? 'Enter the amount you want to subtract from the current invoice'
                    : 'Enter what the new invoice total should be'}
                </p>
              </div>

              {/* Preview Card */}
              {scholarshipAmount && parseFloat(scholarshipAmount) > 0 && (
                <div className="mb-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <p className="text-xs uppercase tracking-wider text-green-700 font-medium mb-2">Preview</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Amount</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(selectedInvoice.amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Scholarship</span>
                      <span className="text-green-600 font-medium">
                        − {formatCurrency(
                          scholarshipMode === 'deduct'
                            ? parseFloat(scholarshipAmount)
                            : selectedInvoice.amount - parseFloat(scholarshipAmount)
                        )}
                      </span>
                    </div>
                    <div className="border-t border-green-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-900 font-semibold">New Total</span>
                        <span className="text-xl font-bold text-green-700">
                          {formatCurrency(
                            scholarshipMode === 'deduct'
                              ? Math.max(0, selectedInvoice.amount - parseFloat(scholarshipAmount))
                              : parseFloat(scholarshipAmount)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Note Field */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={scholarshipNote}
                  onChange={(e) => setScholarshipNote(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={2}
                  placeholder="e.g., Financial assistance, returning camper discount, sibling discount..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowScholarshipModal(false);
                    setScholarshipAmount('');
                    setScholarshipNote('');
                    setScholarshipMode('deduct');
                  }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyScholarship}
                  disabled={paymentActionLoading || !scholarshipAmount || !scholarshipNote || parseFloat(scholarshipAmount) <= 0}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {paymentActionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4" />
                      <span>Apply Scholarship</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal - Green Theme */}
      {showMarkPaidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Mark as Paid</h3>
                  <p className="text-green-100 text-sm">Record offline payment</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Amount Display */}
              <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs uppercase tracking-wider text-green-700 font-medium mb-1">Payment Amount</p>
                <p className="text-3xl font-bold text-green-800 tabular-nums">
                  {formatCurrency(selectedInvoice.amount)}
                </p>
              </div>

              {/* Note Field */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Payment Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={paidNote}
                  onChange={(e) => setPaidNote(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  rows={2}
                  placeholder="e.g., Check #1234, Cash payment, Venmo transfer..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowMarkPaidModal(false); setPaidNote(''); }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkPaid}
                  disabled={paymentActionLoading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {paymentActionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Confirm Payment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Unpaid Modal - Amber Theme */}
      {showMarkUnpaidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Reverse Payment</h3>
                  <p className="text-amber-100 text-sm">Create new invoice</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Warning Banner */}
              <div className="mb-5 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">This action will:</p>
                    <ul className="mt-1 text-sm text-amber-700 list-disc list-inside space-y-1">
                      <li>Void the current {formatCurrency(selectedInvoice.amount)} payment</li>
                      <li>Create a new open invoice for the same amount</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Reason Field */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={unpaidReason}
                  onChange={(e) => setUnpaidReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                  rows={2}
                  placeholder="e.g., Payment bounced, Refund requested, Administrative correction..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowMarkUnpaidModal(false); setUnpaidReason(''); }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkUnpaid}
                  disabled={paymentActionLoading || !unpaidReason}
                  className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {paymentActionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>Reverse Payment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal - Red Destructive Theme */}
      {showVoidModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Void Invoice</h3>
                  <p className="text-red-100 text-sm">Permanently cancel</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Amount Display */}
              <div className="mb-5 p-4 bg-red-50 rounded-xl border border-red-200">
                <p className="text-xs uppercase tracking-wider text-red-700 font-medium mb-1">Invoice Amount</p>
                <p className="text-3xl font-bold text-red-800 tabular-nums line-through decoration-2">
                  {formatCurrency(selectedInvoice.amount)}
                </p>
              </div>

              {/* Warning Banner */}
              <div className="mb-5 p-3 bg-red-100 rounded-lg border border-red-300">
                <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  This action cannot be undone
                </p>
              </div>

              {/* Reason Field */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={2}
                  placeholder="e.g., Camper withdrew, Duplicate invoice, Administrative error..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowVoidModal(false); setVoidReason(''); }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  disabled={paymentActionLoading || !voidReason}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {paymentActionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Voiding...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Void Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Plan Modal - Purple Theme */}
      {showPaymentPlanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Divide className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create Payment Plan</h3>
                  <p className="text-purple-100 text-sm">Split invoice into installments</p>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Original Invoice Info */}
              {paymentSummary && (() => {
                const openInvoice = paymentSummary.invoices.find(inv => inv.status === 'open')
                const originalAmount = openInvoice?.amount || 0
                const totalEntered = paymentPlanPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                const remaining = originalAmount - totalEntered
                const isBalanced = Math.abs(remaining) < 0.01

                return (
                  <>
                    <div className="mb-5 p-4 bg-purple-50 rounded-xl border border-purple-200">
                      <p className="text-xs uppercase tracking-wider text-purple-700 font-medium mb-1">Original Invoice</p>
                      <p className="text-3xl font-bold text-purple-800 tabular-nums">
                        {formatCurrency(originalAmount)}
                      </p>
                    </div>

                    {/* Payment Installments */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Payment Schedule</label>
                      <div className="space-y-3">
                        {paymentPlanPayments.map((payment, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-700">
                                Payment {index + 1} of {paymentPlanPayments.length}
                              </span>
                              {paymentPlanPayments.length > 2 && (
                                <button
                                  onClick={() => setPaymentPlanPayments(paymentPlanPayments.filter((_, i) => i !== index))}
                                  className="ml-auto p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={payment.amount}
                                  onChange={(e) => {
                                    const updated = [...paymentPlanPayments]
                                    updated[index].amount = e.target.value
                                    setPaymentPlanPayments(updated)
                                  }}
                                  className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 tabular-nums"
                                  placeholder="Amount"
                                />
                              </div>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                  type="date"
                                  value={payment.due_date}
                                  onChange={(e) => {
                                    const updated = [...paymentPlanPayments]
                                    updated[index].due_date = e.target.value
                                    setPaymentPlanPayments(updated)
                                  }}
                                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add Payment Button */}
                    <button
                      onClick={() => setPaymentPlanPayments([...paymentPlanPayments, { amount: '', due_date: '' }])}
                      className="w-full py-2.5 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Add Payment
                    </button>

                    {/* Summary Card */}
                    <div className={`mt-5 p-4 rounded-xl border ${
                      isBalanced
                        ? 'bg-green-50 border-green-200'
                        : remaining > 0
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Entered</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(totalEntered)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Original Invoice</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(originalAmount)}</span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className={`font-medium ${
                              isBalanced ? 'text-green-700' : remaining > 0 ? 'text-amber-700' : 'text-red-700'
                            }`}>
                              {isBalanced ? '✓ Balanced' : remaining > 0 ? 'Remaining' : 'Over by'}
                            </span>
                            {!isBalanced && (
                              <span className={`font-bold tabular-nums ${remaining > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                                {formatCurrency(Math.abs(remaining))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="p-6 pt-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentPlanModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePaymentPlan}
                  disabled={paymentActionLoading}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {paymentActionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Divide className="h-4 w-4" />
                      <span>Create Plan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
