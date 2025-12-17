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
  Send
} from 'lucide-react'

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
  isLoading?: boolean
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
  isLoading = false,
  isOpen: controlledIsOpen,
  onOpenChange
}: AdminActionPanelProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open)
    }
    setInternalIsOpen(open)
  }
  const [activeTab, setActiveTab] = useState<'approval' | 'notes' | 'meta'>('approval')
  const [actionNote, setActionNote] = useState('')
  const [newNote, setNewNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [noteLoading, setNoteLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
        className={`fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${
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
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('approval')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'approval'
                ? 'text-camp-green border-b-2 border-camp-green bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Approval</span>
              {approvalStatus && (
                <span className="bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                  {approvalStatus.approval_count}/3
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'notes'
                ? 'text-camp-green border-b-2 border-camp-green bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Notes</span>
              {notes.length > 0 && (
                <span className="bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                  {notes.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('meta')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'meta'
                ? 'text-camp-green border-b-2 border-camp-green bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Details</span>
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
                      {approvalStatus.approved_by.map((admin) => (
                        <div key={admin.admin_id} className="flex items-start gap-2 bg-green-50 rounded p-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-800">
                              {admin.name}
                              {admin.team && (
                                <span className="ml-1 text-xs bg-green-200 text-green-700 px-1.5 py-0.5 rounded uppercase">
                                  {admin.team}
                                </span>
                              )}
                            </p>
                            {admin.note && (
                              <p className="text-xs text-green-700 mt-1 italic">"{admin.note}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Who declined */}
                  {approvalStatus.declined_by.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase">Declined by:</p>
                      {approvalStatus.declined_by.map((admin) => (
                        <div key={admin.admin_id} className="flex items-start gap-2 bg-red-50 rounded p-2">
                          <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-800">
                              {admin.name}
                              {admin.team && (
                                <span className="ml-1 text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded uppercase">
                                  {admin.team}
                                </span>
                              )}
                            </p>
                            {admin.note && (
                              <p className="text-xs text-red-700 mt-1 italic">"{admin.note}"</p>
                            )}
                          </div>
                        </div>
                      ))}
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
                              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-medium">
                                {note.admin.team}
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
    </>
  )
}
