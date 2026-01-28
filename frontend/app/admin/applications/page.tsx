/**
 * Admin Applications List Page
 * View and filter all applications
 */

'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useStatusColors } from '@/lib/contexts/StatusColorsContext'
import { useTeamColors } from '@/lib/contexts/TeamColorsContext'
import { useToast } from '@/components/shared/ToastNotification'
import { getAllApplications, ApplicationWithUser } from '@/lib/api-admin'
import {
  promoteToCamper,
  addToWaitlist,
  removeFromWaitlist,
  deactivateApplication,
  approveApplication,
  deferApplication
} from '@/lib/api-admin-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateOnlyCST } from '@/lib/date-utils'
import { ArrowUp, ArrowDown, ArrowUpDown, Mail, Send, Loader2 } from 'lucide-react'
import { NotesModal } from '@/components/admin/NotesModal'
import { ApplicationActionStrip } from '@/components/admin/ApplicationActionStrip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { sendAdHocEmail } from '@/lib/api-emails'
import { ConfirmationModal } from '@/components/shared/ConfirmationModal'

// Sortable column keys
type SortColumn = 'applicant' | 'camper' | 'status' | 'progress' | 'approvals' | 'created' | null
type SortDirection = 'asc' | 'desc'

// Sub-status order for sorting (lower = earlier in sort)
// Applicant sub-statuses first, then Camper, then Inactive
const SUB_STATUS_ORDER: Record<string, number> = {
  // Applicant sub-statuses
  'not_started': 1,
  'incomplete': 2,
  'complete': 3,
  'under_review': 4,
  'waitlist': 5,
  // Camper sub-statuses (same 'complete' value)
  // Inactive sub-status
  'inactive': 6,
}

// Status order (main lifecycle phase)
const STATUS_ORDER: Record<string, number> = {
  'applicant': 1,
  'camper': 2,
  'inactive': 3,
}

// LocalStorage key for sort preference
const SORT_STORAGE_KEY = 'admin-applications-sort'

function AdminApplicationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, user } = useAuth()
  const { getStatusStyle, getStatusColor, getCategoryStyle, getCategoryColor } = useStatusColors()
  const { getTeamColor, getTeamStyle } = useTeamColors()
  const toast = useToast()
  const [applications, setApplications] = useState<ApplicationWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Initialize filter from URL query params
  useEffect(() => {
    const urlStatus = searchParams.get('status')
    if (urlStatus !== null) {
      setStatusFilter(urlStatus)
    }
  }, [searchParams])

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Notes modal state
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [selectedAppForNotes, setSelectedAppForNotes] = useState<{ id: string; camperName: string } | null>(null)

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [selectedAppForEmail, setSelectedAppForEmail] = useState<ApplicationWithUser | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    type: 'promote' | 'waitlist' | 'removeWaitlist' | 'deactivate' | 'defer' | null
    app: ApplicationWithUser | null
    action?: 'promote' | 'return_review'
  }>({ type: null, app: null })
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Load sort preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY)
      if (saved) {
        const { column, direction } = JSON.parse(saved)
        if (column) setSortColumn(column)
        if (direction) setSortDirection(direction)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Save sort preference to localStorage when it changes
  useEffect(() => {
    try {
      if (sortColumn) {
        localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ column: sortColumn, direction: sortDirection }))
      } else {
        localStorage.removeItem(SORT_STORAGE_KEY)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [sortColumn, sortDirection])

  // Load filtered applications (for table)
  useEffect(() => {
    if (!token) return

    const loadApplications = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
        setApplications(data)
      } catch (err) {
        console.error('Failed to load applications:', err)
        setError(err instanceof Error ? err.message : 'Failed to load applications')
      } finally {
        setLoading(false)
      }
    }

    loadApplications()
  }, [token, statusFilter, searchTerm])

  // Approve application handler - now requires note, so redirect to detail page
  const handleApprove = async (applicationId: string) => {
    // Approving now requires a note - direct users to the detail page
    toast.info('Approving or declining an application now requires adding a note. Please open the application detail page to approve using the Admin Panel.')
    router.push(`/admin/applications/${applicationId}`)
  }

  // Open notes modal for an application
  const openNotesModal = (app: ApplicationWithUser) => {
    const camperName = app.camper_first_name && app.camper_last_name
      ? `${app.camper_first_name} ${app.camper_last_name}`
      : `${app.user?.first_name || ''} ${app.user?.last_name || ''}`
    setSelectedAppForNotes({ id: app.id, camperName })
    setNotesModalOpen(true)
  }

  // Refresh applications after note is added
  const handleNoteAdded = async () => {
    if (!token) return
    const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
    setApplications(data)
  }

  // Open email modal for an application
  const openEmailModal = (app: ApplicationWithUser) => {
    const camperName = app.camper_first_name && app.camper_last_name
      ? `${app.camper_first_name} ${app.camper_last_name}`
      : 'Your Camper'
    const userFirstName = app.user?.first_name || 'there'
    setSelectedAppForEmail(app)
    setEmailSubject(`CAMP FASD - Regarding ${camperName}'s Application`)
    // Pre-populate with greeting so admin can see/edit it
    setEmailMessage(`Dear ${userFirstName},\n\n`)
    setEmailModalOpen(true)
  }

  // Send ad-hoc email
  const handleSendEmail = async () => {
    if (!token || !selectedAppForEmail || !emailSubject.trim() || !emailMessage.trim()) return

    setEmailSending(true)
    try {
      await sendAdHocEmail(token, selectedAppForEmail.id, emailSubject, emailMessage)
      toast.success('Email sent successfully!')
      setEmailModalOpen(false)
      setSelectedAppForEmail(null)
      setEmailSubject('')
      setEmailMessage('')
    } catch (err) {
      console.error('Failed to send email:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailSending(false)
    }
  }

  // Show promote confirmation modal
  const showPromoteConfirm = (app: ApplicationWithUser) => {
    setConfirmModal({ type: 'promote', app })
  }

  // Execute promote to camper after confirmation
  const executePromoteToCamper = async () => {
    if (!token || !confirmModal.app) return

    setConfirmLoading(true)
    try {
      await promoteToCamper(token, confirmModal.app.id)

      // Refresh list
      const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      setApplications(data)

      setConfirmModal({ type: null, app: null })
      toast.success('Application promoted to Camper successfully!')
    } catch (err) {
      console.error('Failed to promote application:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to promote application')
    } finally {
      setConfirmLoading(false)
    }
  }

  // Show add to waitlist confirmation modal
  const showWaitlistConfirm = (app: ApplicationWithUser) => {
    setConfirmModal({ type: 'waitlist', app })
  }

  // Execute add to waitlist after confirmation
  const executeAddToWaitlist = async () => {
    if (!token || !confirmModal.app) return

    setConfirmLoading(true)
    try {
      await addToWaitlist(token, confirmModal.app.id)
      const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      setApplications(data)
      setConfirmModal({ type: null, app: null })
      toast.success('Application added to waitlist')
    } catch (err) {
      console.error('Failed to add to waitlist:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to add to waitlist')
    } finally {
      setConfirmLoading(false)
    }
  }

  // Show remove from waitlist confirmation modal
  const showRemoveWaitlistConfirm = (app: ApplicationWithUser, action: 'promote' | 'return_review') => {
    setConfirmModal({ type: 'removeWaitlist', app, action })
  }

  // Execute remove from waitlist after confirmation
  const executeRemoveFromWaitlist = async () => {
    if (!token || !confirmModal.app || !confirmModal.action) return

    setConfirmLoading(true)
    try {
      await removeFromWaitlist(token, confirmModal.app.id, confirmModal.action)
      const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      setApplications(data)
      const successMsg = confirmModal.action === 'promote' ? 'Application promoted to Camper' : 'Application returned to review'
      setConfirmModal({ type: null, app: null })
      toast.success(successMsg)
    } catch (err) {
      console.error('Failed to remove from waitlist:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to remove from waitlist')
    } finally {
      setConfirmLoading(false)
    }
  }

  // Show deactivate confirmation modal
  const showDeactivateConfirm = (app: ApplicationWithUser) => {
    setConfirmModal({ type: 'deactivate', app })
  }

  // Execute deactivate after confirmation
  const executeDeactivate = async () => {
    if (!token || !confirmModal.app) return

    setConfirmLoading(true)
    try {
      await deactivateApplication(token, confirmModal.app.id)
      const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      setApplications(data)
      setConfirmModal({ type: null, app: null })
      toast.success('Application deactivated')
    } catch (err) {
      console.error('Failed to deactivate application:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate application')
    } finally {
      setConfirmLoading(false)
    }
  }

  // Show defer confirmation modal (when 1+ declines exist)
  const showDeferConfirm = (app: ApplicationWithUser) => {
    setConfirmModal({ type: 'defer', app })
  }

  // Execute defer after confirmation
  const executeDefer = async () => {
    if (!token || !confirmModal.app) return

    setConfirmLoading(true)
    try {
      await deferApplication(token, confirmModal.app.id)
      const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      setApplications(data)
      setConfirmModal({ type: null, app: null })
      toast.success('Application deferred to next year')
    } catch (err) {
      console.error('Failed to defer application:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to defer application')
    } finally {
      setConfirmLoading(false)
    }
  }

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Same column: toggle direction, or clear if already desc
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        // Clear sort
        setSortColumn(null)
        setSortDirection('asc')
      }
    } else {
      // New column: set to asc
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Get sort icon for a column
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 ml-1 text-camp-green" />
      : <ArrowDown className="w-4 h-4 ml-1 text-camp-green" />
  }

  // Sorted applications using useMemo for performance
  const sortedApplications = useMemo(() => {
    if (!sortColumn) return applications

    return [...applications].sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'applicant': {
          const aName = `${a.user?.last_name || ''} ${a.user?.first_name || ''}`.toLowerCase()
          const bName = `${b.user?.last_name || ''} ${b.user?.first_name || ''}`.toLowerCase()
          comparison = aName.localeCompare(bName)
          break
        }
        case 'camper': {
          const aName = `${a.camper_last_name || ''} ${a.camper_first_name || ''}`.toLowerCase()
          const bName = `${b.camper_last_name || ''} ${b.camper_first_name || ''}`.toLowerCase()
          comparison = aName.localeCompare(bName)
          break
        }
        case 'status': {
          // First sort by status (applicant, camper, inactive)
          const aStatusOrder = STATUS_ORDER[a.status] || 99
          const bStatusOrder = STATUS_ORDER[b.status] || 99
          comparison = aStatusOrder - bStatusOrder
          // If same status, sort by sub_status
          if (comparison === 0) {
            const aSubOrder = SUB_STATUS_ORDER[a.sub_status] || 99
            const bSubOrder = SUB_STATUS_ORDER[b.sub_status] || 99
            comparison = aSubOrder - bSubOrder
          }
          break
        }
        case 'progress': {
          comparison = (a.completion_percentage || 0) - (b.completion_percentage || 0)
          break
        }
        case 'approvals': {
          comparison = (a.approval_count || 0) - (b.approval_count || 0)
          break
        }
        case 'created': {
          const aDate = new Date(a.created_at).getTime()
          const bDate = new Date(b.created_at).getTime()
          comparison = aDate - bDate
          break
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [applications, sortColumn, sortDirection])

  if (loading && applications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-camp-green"></div>
      </div>
    )
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
        <p className="mt-2 text-gray-600">
          Review and manage all camper applications
        </p>
      </div>

      {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-l-red-500 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Applications Table */}
        <Card className="shadow-md">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b pb-4">
            {/* Top row: Title and Filter */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">All Applications</CardTitle>
                <CardDescription className="mt-1">
                  Showing {applications.length} {applications.length === 1 ? 'application' : 'applications'}
                </CardDescription>
              </div>

              {/* Filter - Top Right */}
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors bg-white min-w-[180px]"
                >
                  <option value="open">All Open</option>
                  <option value="">All (incl. Inactive)</option>
                  <optgroup label="Applicant">
                    <option value="applicant">All Applicants</option>
                    <option value="applicant:not_started">Not Started</option>
                    <option value="applicant:incomplete">Incomplete</option>
                    <option value="applicant:complete">Complete</option>
                    <option value="applicant:under_review">Under Review</option>
                    <option value="applicant:waitlist">Waitlist</option>
                  </optgroup>
                  <optgroup label="Camper">
                    <option value="camper">All Campers</option>
                    <option value="camper:incomplete">Incomplete</option>
                    <option value="camper:complete">Complete</option>
                  </optgroup>
                  <optgroup label="Inactive">
                    <option value="inactive">All Inactive</option>
                    <option value="inactive:withdrawn">Withdrawn</option>
                    <option value="inactive:deferred">Deferred</option>
                    <option value="inactive:rejected">Rejected</option>
                    <option value="inactive:inactive">Deactivated</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Search - Centered below title */}
            <div className="mt-4 flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors bg-white/80 backdrop-blur-sm shadow-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No applications found
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 relative">
                <table className="w-full min-w-[1400px]">
                  <thead className="bg-gray-50">
                    <tr className="border-b-2 border-gray-200">
                      {/* Sticky left columns */}
                      <th
                        onClick={() => handleSort('camper')}
                        className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none sticky left-0 bg-gray-50 z-20 min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                      >
                        <span className="flex items-center">
                          Camper
                          {getSortIcon('camper')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('applicant')}
                        className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none sticky left-[150px] bg-gray-50 z-20 min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                      >
                        <span className="flex items-center">
                          Parent
                          {getSortIcon('applicant')}
                        </span>
                      </th>
                      {/* Scrollable middle columns */}
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[60px]">
                        Age
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[70px]">
                        Gender
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[80px]">
                        BeST
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[90px]">
                        Returning?
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[90px]">
                        Paid Invoice
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none min-w-[100px]"
                      >
                        <span className="flex items-center">
                          Status
                          {getSortIcon('status')}
                        </span>
                      </th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                        Stage
                      </th>
                      <th
                        onClick={() => handleSort('progress')}
                        className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none min-w-[140px]"
                      >
                        <span className="flex items-center">
                          Progress
                          {getSortIcon('progress')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('approvals')}
                        className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none min-w-[100px]"
                      >
                        <span className="flex items-center">
                          Approvals
                          {getSortIcon('approvals')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('created')}
                        className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none min-w-[100px]"
                      >
                        <span className="flex items-center">
                          Created
                          {getSortIcon('created')}
                        </span>
                      </th>
                      {/* Sticky right column */}
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-50 z-20 min-w-[200px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {sortedApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50 transition-colors group">
                        {/* Sticky left: Camper */}
                        <td className="py-4 px-4 sticky left-0 bg-white group-hover:bg-gray-50 z-10 min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="font-semibold text-camp-charcoal text-sm">
                            {app.camper_first_name && app.camper_last_name
                              ? `${app.camper_first_name} ${app.camper_last_name}`
                              : <span className="text-gray-400 italic text-xs">Not specified</span>
                            }
                          </div>
                        </td>
                        {/* Sticky left: Parent */}
                        <td className="py-4 px-4 sticky left-[150px] bg-white group-hover:bg-gray-50 z-10 min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div>
                            <div className="font-medium text-camp-charcoal text-sm">
                              {app.user?.first_name} {app.user?.last_name}
                            </div>
                            {app.user?.email && (
                              <a
                                href={`mailto:${app.user.email}?subject=CAMP FASD - ${app.camper_first_name || 'Your'} ${app.camper_last_name || 'Camper'}'s Application`}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline mt-0.5 truncate max-w-[160px] block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {app.user.email}
                              </a>
                            )}
                            {app.user?.phone && (
                              <a
                                href={`tel:${app.user.phone}`}
                                className="text-xs text-gray-500 hover:text-camp-green hover:underline truncate max-w-[160px] block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                📞 {app.user.phone}
                              </a>
                            )}
                          </div>
                        </td>
                        {/* Age */}
                        <td className="py-4 px-4 min-w-[60px]">
                          {app.camper_dob ? (
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-semibold text-camp-green hover:text-camp-green/80 cursor-pointer">
                                  {app.camper_age}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-camp-green text-white px-4 py-2.5 rounded-lg shadow-lg border-0"
                              >
                                <p className="text-xs font-medium opacity-90">Date of Birth</p>
                                <p className="text-base font-bold">
                                  {new Date(app.camper_dob + 'T00:00:00').toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-sm font-medium text-gray-700">
                              {app.camper_age || <span className="text-gray-400">—</span>}
                            </span>
                          )}
                        </td>
                        {/* Gender */}
                        <td className="py-4 px-4 min-w-[70px]">
                          {app.camper_gender ? (
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              app.camper_gender.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-700' :
                              app.camper_gender.toLowerCase() === 'female' ? 'bg-pink-100 text-pink-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {app.camper_gender.charAt(0).toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        {/* FASD BeST Score */}
                        <td className="py-4 px-4 min-w-[80px]">
                          {app.fasd_best_score != null ? (
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              app.fasd_best_score <= 54 ? 'bg-green-100 text-green-700' :
                              app.fasd_best_score <= 108 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {app.fasd_best_score}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                        {/* Returning Camper? */}
                        <td className="py-4 px-4 min-w-[90px]">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            app.is_returning_camper
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {app.is_returning_camper ? 'True' : 'False'}
                          </span>
                        </td>
                        {/* Paid Invoice */}
                        <td className="py-4 px-4 min-w-[90px]">
                          {app.status === 'applicant' ? (
                            <span className="text-gray-400 text-xs">N/A</span>
                          ) : app.paid_invoice === true ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              ✓ Yes
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-rose-100 text-rose-700">
                              ✗ No
                            </span>
                          )}
                        </td>
                        {/* Status - Just Applicant/Camper/Inactive */}
                        <td className="py-4 px-4 min-w-[100px]">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2"
                            style={getCategoryStyle(app.status)}
                          >
                            {getCategoryColor(app.status).label}
                          </span>
                        </td>
                        {/* Stage - Sub-status */}
                        <td className="py-4 px-4 min-w-[120px]">
                          <span
                            className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap"
                            style={getStatusStyle(app.status, app.sub_status)}
                          >
                            {getStatusColor(app.status, app.sub_status).label}
                          </span>
                        </td>
                        {/* Progress */}
                        <td className="py-4 px-4 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  app.completion_percentage === 100 ? 'bg-green-500' : 'bg-camp-green'
                                }`}
                                style={{ width: `${app.completion_percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 min-w-[35px]">
                              {app.completion_percentage}%
                            </span>
                          </div>
                        </td>
                        {/* Approvals */}
                        <td className="py-4 px-4 min-w-[100px]">
                          <div className="flex flex-col gap-1">
                            <div className="text-xs font-semibold text-gray-700">
                              {app.approval_count || 0}/3
                            </div>
                            {app.approved_by_teams && app.approved_by_teams.length > 0 && (
                              <div className="flex flex-wrap gap-0.5">
                                {app.approved_by_teams.map((team, idx) => {
                                  const teamColor = getTeamColor(team)
                                  return (
                                    <span
                                      key={idx}
                                      className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded"
                                      style={getTeamStyle(team)}
                                      title={teamColor.name}
                                    >
                                      {teamColor.name}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Created */}
                        <td className="py-4 px-4 min-w-[100px]">
                          <div className="text-xs text-gray-600">
                            {formatDateOnlyCST(app.created_at)}
                          </div>
                        </td>
                        {/* Sticky right: Actions */}
                        <td className="py-4 px-4 sticky right-0 bg-white group-hover:bg-gray-50 z-10 min-w-[220px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <ApplicationActionStrip
                            app={app}
                            userRole={user?.role}
                            onOpenNotes={openNotesModal}
                            onOpenEmail={openEmailModal}
                            onPromote={showPromoteConfirm}
                            onApprove={handleApprove}
                            onWaitlist={showWaitlistConfirm}
                            onRemoveWaitlist={showRemoveWaitlistConfirm}
                            onDeactivate={showDeactivateConfirm}
                            onDefer={showDeferConfirm}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Notes Modal */}
      {selectedAppForNotes && token && (
        <NotesModal
          isOpen={notesModalOpen}
          onClose={() => {
            setNotesModalOpen(false)
            setSelectedAppForNotes(null)
          }}
          applicationId={selectedAppForNotes.id}
          camperName={selectedAppForNotes.camperName}
          token={token}
          onNoteAdded={handleNoteAdded}
        />
      )}

      {/* Email Family Dialog */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-camp-green" />
              Email Family
            </DialogTitle>
            <DialogDescription>
              {selectedAppForEmail && (
                <>
                  Send an email to{' '}
                  <span className="font-medium text-gray-800">{selectedAppForEmail.user?.first_name} {selectedAppForEmail.user?.last_name}</span>
                  {' '}regarding{' '}
                  <span className="font-medium text-gray-800">
                    {selectedAppForEmail.camper_first_name && selectedAppForEmail.camper_last_name
                      ? `${selectedAppForEmail.camper_first_name} ${selectedAppForEmail.camper_last_name}`
                      : 'their camper'}
                  </span>'s application.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                placeholder="Email subject..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent resize-none"
                placeholder="Type your message here..."
              />
              <p className="mt-1 text-xs text-gray-500">
                The message will be wrapped in CAMP's branded email template with logo and contact info.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailModalOpen(false)}
              disabled={emailSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
              className="bg-camp-green hover:bg-camp-green/90"
            >
              {emailSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modals */}
      {/* Promote to Camper */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'promote'}
        onClose={() => setConfirmModal({ type: null, app: null })}
        onConfirm={executePromoteToCamper}
        title="Accept as Camper"
        message={
          <>
            Are you sure you want to accept{' '}
            <span className="font-semibold">
              {confirmModal.app?.camper_first_name} {confirmModal.app?.camper_last_name}
            </span>{' '}
            as a camper?
            <div className="mt-3 p-3 bg-green-50 rounded-lg text-xs text-green-800">
              <p className="font-medium mb-1">This action will:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Generate a payment invoice</li>
                <li>Send an acceptance email with payment link</li>
                <li>Enable additional post-acceptance sections</li>
              </ul>
            </div>
          </>
        }
        confirmLabel="Accept"
        theme="success"
        isLoading={confirmLoading}
      />

      {/* Add to Waitlist */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'waitlist'}
        onClose={() => setConfirmModal({ type: null, app: null })}
        onConfirm={executeAddToWaitlist}
        title="Add to Waitlist"
        message={
          <>
            Are you sure you want to add{' '}
            <span className="font-semibold">
              {confirmModal.app?.camper_first_name} {confirmModal.app?.camper_last_name}
            </span>{' '}
            to the waitlist?
            <div className="mt-3 p-3 bg-purple-50 rounded-lg text-xs text-purple-800">
              <p>The family will be notified that acceptance is delayed due to staffing constraints. They can still be promoted to camper status later.</p>
            </div>
          </>
        }
        confirmLabel="Add to Waitlist"
        theme="purple"
        isLoading={confirmLoading}
      />

      {/* Remove from Waitlist */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'removeWaitlist'}
        onClose={() => setConfirmModal({ type: null, app: null })}
        onConfirm={executeRemoveFromWaitlist}
        title={confirmModal.action === 'promote' ? 'Accept from Waitlist' : 'Return to Review'}
        message={
          confirmModal.action === 'promote' ? (
            <>
              Are you sure you want to accept{' '}
              <span className="font-semibold">
                {confirmModal.app?.camper_first_name} {confirmModal.app?.camper_last_name}
              </span>{' '}
              from the waitlist as a camper?
              <div className="mt-3 p-3 bg-green-50 rounded-lg text-xs text-green-800">
                <p className="font-medium mb-1">This action will:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Remove from waitlist</li>
                  <li>Generate a payment invoice</li>
                  <li>Send an acceptance email with payment link</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              Are you sure you want to return{' '}
              <span className="font-semibold">
                {confirmModal.app?.camper_first_name} {confirmModal.app?.camper_last_name}
              </span>{' '}
              to review status?
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
                <p>This will remove them from the waitlist and set their status back to "Under Review".</p>
              </div>
            </>
          )
        }
        confirmLabel={confirmModal.action === 'promote' ? 'Accept' : 'Return to Review'}
        theme={confirmModal.action === 'promote' ? 'success' : 'info'}
        isLoading={confirmLoading}
      />

      {/* Deactivate */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'deactivate'}
        onClose={() => setConfirmModal({ type: null, app: null })}
        onConfirm={executeDeactivate}
        title="Deactivate Application"
        message={
          <>
            Are you sure you want to deactivate{' '}
            <span className="font-semibold">
              {confirmModal.app?.camper_first_name} {confirmModal.app?.camper_last_name}
            </span>'s application?
            <div className="mt-3 p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
              <p className="font-medium mb-1">This action will:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Hide the application from default views</li>
                <li>Mark the application as inactive</li>
                <li>The application can still be viewed in the "Inactive" filter</li>
              </ul>
            </div>
          </>
        }
        confirmLabel="Deactivate"
        theme="warning"
        isLoading={confirmLoading}
      />

      {/* Defer to Next Year */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'defer'}
        onClose={() => setConfirmModal({ type: null, app: null })}
        onConfirm={executeDefer}
        title="Defer to Next Year"
        message={
          <>
            Are you sure you want to defer{' '}
            <span className="font-semibold">
              {confirmModal.app?.camper_first_name} {confirmModal.app?.camper_last_name}
            </span>'s application to next year?
            <div className="mt-3 p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
              <p className="font-medium mb-1">This action will:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Move application to <strong>Inactive → Deferred</strong> status</li>
                <li>The family can reapply next year</li>
                <li>A deferral notification will be sent to the family</li>
              </ul>
            </div>
            {confirmModal.app?.decline_count && confirmModal.app.decline_count > 0 && (
              <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                <strong>Note:</strong> This application has {confirmModal.app.decline_count} decline{confirmModal.app.decline_count > 1 ? 's' : ''} from the review team.
              </div>
            )}
          </>
        }
        confirmLabel="Defer Application"
        theme="warning"
        isLoading={confirmLoading}
      />
    </div>
    </TooltipProvider>
  )
}

// Default export with Suspense boundary for useSearchParams
// Required by Next.js 14+ for static generation / prerendering
export default function AdminApplicationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-camp-green mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading applications...</p>
        </div>
      </div>
    }>
      <AdminApplicationsContent />
    </Suspense>
  )
}
