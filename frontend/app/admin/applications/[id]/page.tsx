/**
 * Admin Application Detail Page
 * View all responses and files for a specific application
 */

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useStatusColors } from '@/lib/contexts/StatusColorsContext'
import { useTeamColors } from '@/lib/contexts/TeamColorsContext'
import { useToast } from '@/components/shared/ToastNotification'
import { getApplicationAdmin, updateApplicationAdmin, getApplicationProgressAdmin, getApplicationSectionsAdmin } from '@/lib/api-admin'
import { ApplicationSection, ApplicationProgress, SectionProgress } from '@/lib/api-applications'
import { getFile, getFilesBatch, FileInfo, uploadFile } from '@/lib/api-files'
import { getAdminNotes, createAdminNote, approveApplication, declineApplication, getApprovalStatus, AdminNote, deferApplication, promoteToCamper } from '@/lib/api-admin-actions'
import { sendAdHocEmail } from '@/lib/api-emails'
import { deleteApplication as deleteApplicationApi } from '@/lib/api-super-admin'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateCST } from '@/lib/date-utils'
import AdminActionPanel from '@/components/admin/AdminActionPanel'
import InvoiceManagement from '@/components/admin/InvoiceManagement'
import MedicationList, { Medication } from '@/components/MedicationList'
import AllergyList, { Allergy } from '@/components/AllergyList'
import GenericTable, { TableRow } from '@/components/GenericTable'

interface ApplicationData {
  id: string
  user_id: string
  camper_first_name?: string
  camper_last_name?: string
  status: string
  sub_status: string
  completion_percentage: number
  is_returning_camper: boolean
  cabin_assignment?: string
  fasd_best_score?: number | null  // FASD BeST score - auto-calculated
  created_at: string
  updated_at: string
  completed_at?: string
  responses?: Array<{
    id: string
    question_id: string
    response_value?: string
    file_id?: string
  }>
}

export default function AdminApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, user, logout } = useAuth()
  const { getStatusStyle, getStatusColor, getCategoryStyle, getCategoryColor } = useStatusColors()
  const { getTeamColor, getTeamStyle } = useTeamColors()
  const toast = useToast()
  const applicationId = params.id as string

  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [sections, setSections] = useState<ApplicationSection[]>([])
  const [progress, setProgress] = useState<ApplicationProgress | null>(null)
  const [files, setFiles] = useState<Record<string, FileInfo>>({})
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<AdminNote[]>([])
  const [approvalStatus, setApprovalStatus] = useState<{
    approval_count: number
    decline_count: number
    current_user_vote: string | null
    approved_by: Array<{ admin_id: string; name: string; team: string | null; note?: string }>
    declined_by: Array<{ admin_id: string; name: string; team: string | null; note?: string }>
  } | null>(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [editingFileQuestion, setEditingFileQuestion] = useState<string | null>(null)
  // Email dialog state
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  // State for complex question types (medications, allergies, tables)
  const [editMedications, setEditMedications] = useState<Medication[]>([])
  const [editAllergies, setEditAllergies] = useState<Allergy[]>([])
  const [editTableData, setEditTableData] = useState<TableRow[]>([])
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  // Camper profile picture for sticky header
  const [profilePictureUrl, setProfilePictureUrl] = useState<string>('')
  // Delete application modal state (super admin only)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const adminSectionRef = useRef<HTMLDivElement | null>(null)

  // Missing questions navigator state
  const [missingQuestions, setMissingQuestions] = useState<Array<{
    questionId: string
    questionText: string
    sectionTitle: string
    isRequired: boolean
  }>>([])
  const [currentMissingIndex, setCurrentMissingIndex] = useState<number>(-1)
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null)
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Check if user is admin
  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  // Callback to refresh application data - can be called from anywhere
  const refreshApplicationData = useCallback(async () => {
    if (!token) return

    try {
      setLoading(true)
      setError('')

      const [appData, sectionsData, progressData] = await Promise.all([
        getApplicationAdmin(token, applicationId),
        getApplicationSectionsAdmin(token, applicationId),
        getApplicationProgressAdmin(token, applicationId)
      ])

      setApplication(appData)
      setSections(sectionsData)
      setProgress(progressData)

      // Load file information for responses with file_id
      const filesMap: Record<string, FileInfo> = {}
      const errorsMap: Record<string, string> = {}

      // Find responses with files (either in file_id or response_value that looks like a UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const responsesWithFiles = (appData.responses || []).filter((r: { file_id?: string; response_value?: string }) => {
        return r.file_id || (r.response_value && uuidRegex.test(r.response_value))
      })

      // OPTIMIZED: Load all files in ONE batch request (not N sequential requests)
      // This reduces N HTTP requests to 1 request
      if (responsesWithFiles.length > 0) {
        try {
          // Collect all file IDs
          const fileIds = responsesWithFiles
            .map((r: { file_id?: string; response_value?: string; question_id: string }) => r.file_id || r.response_value)
            .filter((id): id is string => !!id)

          // Create a map of fileId -> questionId for later lookup
          const fileToQuestionMap: Record<string, string> = {}
          responsesWithFiles.forEach((r: { file_id?: string; response_value?: string; question_id: string }) => {
            const fileId = r.file_id || r.response_value
            if (fileId) {
              fileToQuestionMap[fileId] = r.question_id
            }
          })

          // Batch load all files in one request
          const batchFiles = await getFilesBatch(token, fileIds)

          // Map files to their questions
          for (const fileInfo of batchFiles) {
            const questionId = fileToQuestionMap[fileInfo.id]
            if (questionId) {
              filesMap[questionId] = fileInfo
            }
          }
          setFiles({ ...filesMap })
        } catch (err) {
          console.error('Failed to batch load files:', err)
          // Mark all file responses as errored
          responsesWithFiles.forEach((r: { question_id: string }) => {
            errorsMap[r.question_id] = err instanceof Error ? err.message : 'Failed to load file'
          })
          setFileErrors({ ...errorsMap })
        }
      }
    } catch (err) {
      console.error('Failed to load application:', err)
      setError(err instanceof Error ? err.message : 'Failed to load application')
    } finally {
      setLoading(false)
    }
  }, [token, applicationId])

  // Load application data on mount
  useEffect(() => {
    if (!token) return

    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        const [appData, sectionsData, progressData] = await Promise.all([
          getApplicationAdmin(token, applicationId),
          getApplicationSectionsAdmin(token, applicationId),
          getApplicationProgressAdmin(token, applicationId)
        ])

        console.log('Application data:', appData)
        console.log('Responses:', appData.responses)

        setApplication(appData)
        setSections(sectionsData)
        setProgress(progressData)

        // Load file information for responses with file_id
        const filesMap: Record<string, FileInfo> = {}
        const errorsMap: Record<string, string> = {}

        // Find responses with files (either in file_id or response_value that looks like a UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const responsesWithFiles = (appData.responses || []).filter(r => {
          return r.file_id || (r.response_value && uuidRegex.test(r.response_value))
        })

        // OPTIMIZED: Load all files in ONE batch request (not N sequential requests)
        // This reduces N HTTP requests to 1 request
        if (responsesWithFiles.length > 0) {
          try {
            // Collect all file IDs
            const fileIds = responsesWithFiles
              .map(r => r.file_id || r.response_value)
              .filter((id): id is string => !!id)

            // Create a map of fileId -> questionId for later lookup
            const fileToQuestionMap: Record<string, string> = {}
            responsesWithFiles.forEach(r => {
              const fileId = r.file_id || r.response_value
              if (fileId) {
                fileToQuestionMap[fileId] = r.question_id
              }
            })

            // Batch load all files in one request
            const batchFiles = await getFilesBatch(token, fileIds)

            // Map files to their questions
            for (const fileInfo of batchFiles) {
              const questionId = fileToQuestionMap[fileInfo.id]
              if (questionId) {
                filesMap[questionId] = fileInfo
              }
            }
            setFiles({ ...filesMap })
          } catch (err) {
            console.error('Failed to batch load files:', err)
            responsesWithFiles.forEach(r => {
              errorsMap[r.question_id] = err instanceof Error ? err.message : 'Failed to load file'
            })
            setFileErrors({ ...errorsMap })
          }
        }
      } catch (err) {
        console.error('Failed to load application:', err)
        setError(err instanceof Error ? err.message : 'Failed to load application')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token, applicationId])

  // Extract profile picture URL when files and sections are loaded
  useEffect(() => {
    if (!sections.length || !Object.keys(files).length) return

    // Find the profile_picture question across all sections
    for (const section of sections) {
      for (const question of section.questions) {
        if (question.question_type === 'profile_picture') {
          const fileInfo = files[question.id]
          if (fileInfo?.url) {
            setProfilePictureUrl(fileInfo.url)
            return
          }
        }
      }
    }
  }, [files, sections])

  // Load notes
  useEffect(() => {
    if (!token) return

    const loadNotes = async () => {
      try {
        const fetchedNotes = await getAdminNotes(token, applicationId)
        setNotes(fetchedNotes)
      } catch (err) {
        console.error('Failed to load notes:', err)
      }
    }

    loadNotes()
  }, [token, applicationId])

  // Load approval status
  useEffect(() => {
    if (!token) return

    const loadApprovalStatus = async () => {
      try {
        const status = await getApprovalStatus(token, applicationId)
        setApprovalStatus(status)
      } catch (err) {
        console.error('Failed to load approval status:', err)
      }
    }

    loadApprovalStatus()
  }, [token, applicationId])

  // Handle action=email query parameter (from table dropdown)
  useEffect(() => {
    if (!application || loading) return

    const action = searchParams.get('action')
    if (action === 'email') {
      setShowEmailDialog(true)
      // Clear the query param from URL
      router.replace(`/admin/applications/${applicationId}`, { scroll: false })
    }
  }, [application, loading, searchParams, router, applicationId])

  // Check if a question should be shown based on conditional logic
  const shouldShowQuestion = (question: any): boolean => {
    // If no conditional logic, always show
    if (!question.show_if_question_id || !question.show_if_answer) {
      return true
    }

    // Get the response to the trigger question
    const triggerResponse = application?.responses?.find(
      r => r.question_id === question.show_if_question_id
    )

    // If no trigger response, don't show conditional question
    if (!triggerResponse?.response_value) {
      return false
    }

    // Parse the response value (may be JSON with {value, detail} structure)
    let responseValue = triggerResponse.response_value
    try {
      const parsed = JSON.parse(responseValue)
      if (parsed.value) {
        responseValue = parsed.value
      }
    } catch {
      // Not JSON, use as-is
    }

    // Show if the trigger question has the expected answer
    return responseValue === question.show_if_answer
  }

  // Compute missing questions when data loads
  useEffect(() => {
    if (!sections.length || !application) return

    const missing: Array<{
      questionId: string
      questionText: string
      sectionTitle: string
      isRequired: boolean
    }> = []

    const answeredQuestionIds = new Set(
      application.responses?.map(r => r.question_id) || []
    )

    // Go through sections and questions in order
    sections.forEach(section => {
      section.questions
        .filter(q => shouldShowQuestion(q))
        .forEach(question => {
          // Check if required question is unanswered
          if (question.is_required && !answeredQuestionIds.has(question.id)) {
            missing.push({
              questionId: question.id,
              questionText: question.question_text,
              sectionTitle: section.title,
              isRequired: true
            })
          }
        })
    })

    setMissingQuestions(missing)
    // Reset navigation index when missing questions change
    setCurrentMissingIndex(-1)
  }, [sections, application])

  // Navigate to next missing question
  const goToNextMissing = () => {
    if (missingQuestions.length === 0) return

    // Calculate next index (wrap around)
    const nextIndex = currentMissingIndex < missingQuestions.length - 1
      ? currentMissingIndex + 1
      : 0

    setCurrentMissingIndex(nextIndex)
    const questionId = missingQuestions[nextIndex].questionId

    // Scroll to the question
    const element = questionRefs.current[questionId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Highlight the question with animation
      setHighlightedQuestionId(questionId)

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedQuestionId(null)
      }, 2000)
    }
  }

  const handleCreateNote = async () => {
    if (!token || !newNote.trim()) return

    try {
      setNotesLoading(true)
      const note = await createAdminNote(token, applicationId, { note: newNote })
      setNotes([note, ...notes])
      setNewNote('')
    } catch (err) {
      console.error('Failed to create note:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create note')
    } finally {
      setNotesLoading(false)
    }
  }

  // Handler for adding notes from the floating panel
  const handleAddNoteFromPanel = async (noteText: string) => {
    if (!token || !noteText.trim()) return

    try {
      const note = await createAdminNote(token, applicationId, { note: noteText })
      setNotes([note, ...notes])
    } catch (err) {
      console.error('Failed to create note:', err)
      throw err
    }
  }

  const handleApprove = async (note: string) => {
    if (!token) return

    try {
      setActionLoading(true)
      const result = await approveApplication(token, applicationId, note)

      // Reload approval status
      const status = await getApprovalStatus(token, applicationId)
      setApprovalStatus(status)

      // Reload application if status changed
      if (result.auto_accepted) {
        const updatedApp = await getApplicationAdmin(token, applicationId)
        setApplication(updatedApp as ApplicationData)
      }
    } catch (err) {
      console.error('Failed to approve application:', err)
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const handleDecline = async (note: string) => {
    if (!token) return

    try {
      setActionLoading(true)
      await declineApplication(token, applicationId, note)

      // Reload approval status
      const status = await getApprovalStatus(token, applicationId)
      setApprovalStatus(status)
    } catch (err) {
      console.error('Failed to decline application:', err)
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // Handle deferring application (when 1+ declines exist)
  const handleDefer = async () => {
    if (!token) return

    try {
      await deferApplication(token, applicationId)

      // Reload application data to reflect new status
      await refreshApplicationData()

      toast.success('Application deferred to next year')
    } catch (err) {
      console.error('Failed to defer application:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to defer application')
      throw err
    }
  }

  // Handle accepting application (when 3+ approvals exist)
  const handleAccept = async () => {
    if (!token) return

    try {
      const result = await promoteToCamper(token, applicationId)

      // Reload application data to reflect new status
      await refreshApplicationData()

      toast.success(`Application accepted! ${result.message}`)
    } catch (err) {
      console.error('Failed to accept application:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to accept application')
      throw err
    }
  }

  const handleSendEmail = async () => {
    if (!token || !emailSubject.trim() || !emailMessage.trim()) return

    try {
      setEmailSending(true)
      await sendAdHocEmail(token, applicationId, emailSubject, emailMessage)

      // Clear and close dialog
      setEmailSubject('')
      setEmailMessage('')
      setShowEmailDialog(false)

      // Show success feedback
      toast.success('Email sent successfully!')
    } catch (err) {
      console.error('Failed to send email:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailSending(false)
    }
  }

  const openEmailDialog = () => {
    // Pre-fill subject with camper name if available
    const camperName = application?.camper_first_name && application?.camper_last_name
      ? `${application.camper_first_name} ${application.camper_last_name}`
      : 'your camper'
    setEmailSubject(`Regarding ${camperName}'s CAMP Application`)
    setEmailMessage('')
    setShowEmailDialog(true)
  }

  // Delete application handlers (super admin only)
  // Get the confirmation text - use camper name if available, otherwise "DELETE"
  const getDeleteConfirmationText = () => {
    const camperName = `${application?.camper_first_name || ''} ${application?.camper_last_name || ''}`.trim()
    return camperName || 'DELETE'
  }
  const deleteConfirmationText = getDeleteConfirmationText()
  const hasCamperName = deleteConfirmationText !== 'DELETE'

  const openDeleteModal = () => {
    setDeleteConfirmStep(1)
    setDeleteConfirmText('')
    setShowDeleteModal(true)
  }

  const handleDeleteApplication = async () => {
    if (!token || !application) return

    if (deleteConfirmText !== deleteConfirmationText) {
      toast.warning(`Please type "${deleteConfirmationText}" exactly to confirm deletion.`)
      return
    }

    try {
      setDeleting(true)
      const result = await deleteApplicationApi(token, applicationId)

      // Show success message
      toast.success(result.message)

      // Close modal and redirect to applications list
      setShowDeleteModal(false)
      router.push('/admin/applications')
    } catch (err) {
      console.error('Failed to delete application:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete application')
    } finally {
      setDeleting(false)
    }
  }


  const getResponseValue = (questionId: string) => {
    const response = application?.responses?.find(r => r.question_id === questionId)
    if (!response) return null

    console.log(`Getting response for question ${questionId}:`, response)

    // Check if this is a file response (check file_id OR if response_value looks like a UUID)
    const isFileId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.response_value || '')
    if (response.file_id || isFileId) {
      const file = files[questionId]
      const fileError = fileErrors[questionId]
      console.log(`File for question ${questionId}:`, file)
      console.log(`File error for question ${questionId}:`, fileError)

      // Show error if file failed to load
      if (fileError) {
        return (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded">
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium">Failed to load file</p>
              <p className="text-xs text-red-500 mt-0.5">{fileError}</p>
            </div>
          </div>
        )
      }

      // Show loading if file not yet loaded
      if (!file) {
        return (
          <div className="flex items-center gap-2 text-gray-500">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span className="text-sm">Loading file...</span>
          </div>
        )
      }

      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
            <svg className="h-8 w-8 text-camp-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-camp-charcoal truncate">
                {file.filename}
              </p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB • {file.content_type}
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-camp-green rounded-lg hover:bg-camp-green/90 transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View
              </a>
              <a
                href={file.url}
                download={file.filename}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-camp-green bg-white border border-camp-green rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
            </div>
          </div>
        </div>
      )
    }

    // Regular text response
    if (response.response_value) {
      // Try to parse JSON for special display (medications, allergies, healthcare providers)
      try {
        const parsed = JSON.parse(response.response_value)

        // Handle medication array
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].medication_name !== undefined) {
          return (
            <div className="space-y-3">
              {parsed.map((med: any, idx: number) => (
                <div key={idx} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="font-medium text-blue-900">{med.medication_name}</div>
                  <div className="text-sm text-blue-700 mt-1 grid grid-cols-2 gap-1">
                    <span>Strength: {med.strength || 'N/A'}</span>
                    <span>Form: {med.dose_form || 'N/A'}</span>
                    <span className="col-span-2">Dose: {med.dose_amount || 'N/A'}</span>
                  </div>
                  {med.doses && med.doses.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="text-xs font-medium text-blue-800 mb-1">Schedule:</div>
                      {med.doses.map((dose: any, dIdx: number) => (
                        <div key={dIdx} className="text-xs text-blue-600">
                          • {dose.given_type}{dose.time ? ` at ${dose.time} ${dose.time_period || ''}` : ''}{dose.notes ? ` (${dose.notes})` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }

        // Handle allergy array
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].allergen !== undefined) {
          return (
            <div className="space-y-2">
              {parsed.map((allergy: any, idx: number) => (
                <div key={idx} className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <div className="font-medium text-red-900">{allergy.allergen}</div>
                  <div className="text-sm text-red-700 mt-1">
                    {allergy.reaction && <div>Reaction: {allergy.reaction}</div>}
                    {allergy.severity && <div>Severity: {allergy.severity}</div>}
                    {allergy.notes && <div className="italic">{allergy.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        }

        // Handle healthcare provider array
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].healthcare_provider_name !== undefined) {
          return (
            <div className="space-y-2">
              {parsed.map((provider: any, idx: number) => (
                <div key={idx} className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="font-medium text-green-900">{provider.healthcare_provider_name}</div>
                  <div className="text-sm text-green-700 mt-1">
                    <div>Type: {provider.healthcare_provider_type || 'N/A'}</div>
                    <div>Phone: {provider.healthcare_provider_phone || 'N/A'}</div>
                    <div>May Contact: {provider.healthcare_provider_contact_consent || 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        }

        // Handle JSON with value/detail structure
        if (parsed.value !== undefined) {
          return (
            <span>
              {parsed.value}
              {parsed.detail && <span className="text-gray-500 ml-2">({parsed.detail})</span>}
            </span>
          )
        }
      } catch {
        // Not JSON, return as-is
      }

      return <span className="whitespace-pre-wrap">{response.response_value}</span>
    }

    return <span className="text-gray-400">No response</span>
  }

  const handleStartEdit = (questionId: string, currentValue: string, questionType?: string) => {
    setEditingQuestion(questionId)
    setEditValue(currentValue || '')

    // Initialize complex data types from JSON
    if (questionType === 'medication_list' && currentValue) {
      try {
        const meds = JSON.parse(currentValue)
        setEditMedications(Array.isArray(meds) ? meds : [])
      } catch {
        setEditMedications([])
      }
    } else if (questionType === 'allergy_list' && currentValue) {
      try {
        const allergies = JSON.parse(currentValue)
        setEditAllergies(Array.isArray(allergies) ? allergies : [])
      } catch {
        setEditAllergies([])
      }
    } else if (questionType === 'table' && currentValue) {
      try {
        const rows = JSON.parse(currentValue)
        setEditTableData(Array.isArray(rows) ? rows : [])
      } catch {
        setEditTableData([])
      }
    }
  }

  const handleCancelEdit = () => {
    setEditingQuestion(null)
    setEditValue('')
    setEditMedications([])
    setEditAllergies([])
    setEditTableData([])
  }

  const handleSaveEdit = async (questionId: string, questionType?: string) => {
    if (!token || !application) return

    // Determine the value to save based on question type
    let valueToSave = editValue
    if (questionType === 'medication_list') {
      valueToSave = JSON.stringify(editMedications)
    } else if (questionType === 'allergy_list') {
      valueToSave = JSON.stringify(editAllergies)
    } else if (questionType === 'table') {
      valueToSave = JSON.stringify(editTableData)
    }

    try {
      setSaving(true)
      await updateApplicationAdmin(token, applicationId, {
        responses: [{
          question_id: questionId,
          response_value: valueToSave
        }]
      })

      // Reload fresh data from server to ensure UI matches backend
      const [freshAppData, freshProgressData] = await Promise.all([
        getApplicationAdmin(token, applicationId),
        getApplicationProgressAdmin(token, applicationId)
      ])

      setApplication(freshAppData)
      setProgress(freshProgressData)

      setEditingQuestion(null)
      setEditValue('')

      // Show success feedback
      toast.success('Changes saved successfully!')
    } catch (err) {
      console.error('Failed to save edit:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (questionId: string, file: File) => {
    if (!token || !application) return

    try {
      setUploadingFile(true)

      // Upload the file
      const result = await uploadFile(token, file, applicationId, questionId)

      // Reload the file info
      const fileInfo = await getFile(token, result.file_id)
      setFiles(prev => ({ ...prev, [questionId]: fileInfo }))

      // Reload fresh data from server to ensure UI matches backend
      const [freshAppData, freshProgressData] = await Promise.all([
        getApplicationAdmin(token, applicationId),
        getApplicationProgressAdmin(token, applicationId)
      ])

      setApplication(freshAppData)
      setProgress(freshProgressData)
      setEditingFileQuestion(null)

      // Clear any previous errors for this question
      setFileErrors(prev => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })

      // Show success feedback
      toast.success('File uploaded successfully!')
    } catch (err) {
      console.error('Failed to upload file:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setUploadingFile(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-camp-green"></div>
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{error || 'Application not found'}</p>
            <Button onClick={() => router.push('/admin/applications')}>
              Back to Applications
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSectionId(sectionId)
    }
  }

  const scrollToAdminSection = () => {
    if (adminSectionRef.current) {
      adminSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSectionId('admin')
    }
  }

  const getSectionProgress = (sectionId: string): SectionProgress | undefined => {
    return progress?.section_progress.find(sp => sp.section_id === sectionId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo and Back Button */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/admin/applications')}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <div className="flex items-center">
                <Image
                  src="/camp-logo.png"
                  alt="CAMP - A FASD Community"
                  width={40}
                  height={44}
                  className="object-contain"
                />
                <p className="ml-2 text-xs text-gray-500 font-medium">Admin Portal</p>
              </div>
            </div>

            {/* Right: User Info and Logout */}
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-camp-charcoal">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex">
        {/* Left Sidebar - Section Progress */}
        {/* Hidden on mobile, visible on md+ screens (prioritized over admin nav on md screens) */}
        <aside className="hidden md:block w-64 bg-white border-r border-gray-200 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-camp-charcoal mb-4">Sections</h3>
            <div className="space-y-2">
              {sections.map((section, idx) => {
                const sectionProg = getSectionProgress(section.id)
                const isActive = activeSectionId === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-camp-green text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                          {idx + 1}. {section.title}
                        </p>
                        {sectionProg && (
                          <p className={`text-xs mt-1 ${isActive ? 'text-white/90' : 'text-gray-500'}`}>
                            {sectionProg.answered_required}/{sectionProg.required_questions} required
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {sectionProg?.is_complete ? (
                          <svg className={`w-5 h-5 ${isActive ? 'text-white' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : sectionProg ? (
                          <div className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-camp-orange'}`}>
                            {sectionProg.completion_percentage}%
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Admin Section - Quick access to approval & notes */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-camp-charcoal mb-3">Admin Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={scrollToAdminSection}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    activeSectionId === 'admin'
                      ? 'bg-camp-green text-white'
                      : 'hover:bg-gray-100 text-gray-700 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-5 h-5 ${activeSectionId === 'admin' ? 'text-white' : 'text-camp-green'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className={`text-sm font-medium ${activeSectionId === 'admin' ? 'text-white' : 'text-gray-900'}`}>
                        Approval & Notes
                      </p>
                      {approvalStatus && (
                        <p className={`text-xs mt-0.5 ${activeSectionId === 'admin' ? 'text-white/80' : 'text-gray-500'}`}>
                          {approvalStatus.approval_count}/3 approved
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {/* Email Family Button */}
                <button
                  onClick={openEmailDialog}
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-blue-50 text-gray-700 bg-gray-50 border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email Family</p>
                      <p className="text-xs mt-0.5 text-gray-500">Send a direct message</p>
                    </div>
                  </div>
                </button>

                {/* Delete Application Button (Super Admin Only) */}
                {user?.role === 'super_admin' && (
                  <button
                    onClick={openDeleteModal}
                    className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-red-50 text-gray-700 bg-gray-50 border border-red-200 mt-4"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-700">Delete Application</p>
                        <p className="text-xs mt-0.5 text-red-500">Permanently remove</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Sticky Camper Info Card */}
          {application && (application.camper_first_name || application.camper_last_name) && (
            <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-white/95 backdrop-blur-sm border-b shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-camp-green shadow-md">
                    {profilePictureUrl ? (
                      <AvatarImage src={profilePictureUrl} alt={`${application.camper_first_name} ${application.camper_last_name}`} />
                    ) : null}
                    <AvatarFallback className="bg-camp-green text-white font-bold text-lg">
                      {`${application.camper_first_name?.charAt(0) || ''}${application.camper_last_name?.charAt(0) || ''}`.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-xl font-bold text-camp-charcoal">
                      {application.camper_first_name} {application.camper_last_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                        style={getStatusStyle(application.status, application.sub_status)}
                      >
                        {getStatusColor(application.status, application.sub_status).label}
                      </span>
                      {application.is_returning_camper && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                          Returning Camper
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Progress</p>
                    <p className="text-lg font-bold text-camp-green">{application.completion_percentage}%</p>
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-camp-green h-2 rounded-full transition-all"
                      style={{ width: `${application.completion_percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Application Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full"
                  style={getCategoryStyle(application.status)}
                >
                  {getCategoryColor(application.status).label}
                </span>
                <span
                  className="inline-flex px-2.5 py-1 text-sm font-semibold rounded-full"
                  style={getStatusStyle(application.status, application.sub_status)}
                >
                  {getStatusColor(application.status, application.sub_status).label}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-camp-green h-3 rounded-full transition-all"
                    style={{ width: `${application.completion_percentage}%` }}
                  />
                </div>
                <span className="text-lg font-semibold text-camp-charcoal">
                  {application.completion_percentage}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                {application.completed_at
                  ? formatDateCST(application.completed_at)
                  : <span className="text-gray-500 italic">In progress</span>}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment is now managed via the Admin Panel Payment tab */}

        {/* Application Responses - Show ALL sections */}
        <div className="space-y-6">
          {sections.map((section, sectionIndex) => {
            const sectionProg = getSectionProgress(section.id)

            return (
              <Card
                key={section.id}
                ref={(el) => { sectionRefs.current[section.id] = el }}
                className="scroll-mt-20"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {sectionIndex + 1}. {section.title}
                        {sectionProg?.is_complete && (
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </CardTitle>
                      {section.description && (
                        <CardDescription>{section.description}</CardDescription>
                      )}
                      {/* FASD BeST Score pill - shown for sections with score calculation */}
                      {section.score_calculation_type === 'fasd_best' && (
                        <div className="mt-3">
                          {application?.fasd_best_score != null ? (
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                              application.fasd_best_score <= 54 ? 'bg-green-50 border-green-300 text-green-800' :
                              application.fasd_best_score <= 108 ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                              'bg-red-50 border-red-300 text-red-800'
                            }`}>
                              <span className="text-sm font-medium">FASD BeST Score:</span>
                              <span className="text-xl font-bold">{application.fasd_best_score}</span>
                              <span className="text-xs opacity-75">/ 162</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 bg-gray-50 border-gray-200 text-gray-500">
                              <span className="text-sm font-medium">FASD BeST Score:</span>
                              <span className="text-sm italic">Complete all questions to calculate</span>
                            </div>
                          )}
                        </div>
                      )}
                      {sectionProg && (
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                          <span>{sectionProg.answered_questions}/{sectionProg.total_questions} answered</span>
                          <span className="font-semibold text-camp-green">{sectionProg.completion_percentage}% complete</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {section.questions.length === 0 ? (
                      <p className="text-gray-500 italic">No questions in this section</p>
                    ) : (
                      section.questions
                        .filter(shouldShowQuestion)
                        .map((question, qIndex) => {
                        const value = getResponseValue(question.id)

                        return (
                          <div
                            key={question.id}
                            ref={(el) => { questionRefs.current[question.id] = el }}
                            className={`pb-6 border-b border-gray-100 last:border-0 transition-all duration-300 rounded-lg ${
                              highlightedQuestionId === question.id
                                ? 'bg-amber-100 ring-2 ring-amber-400 ring-offset-2 animate-pulse p-4 -mx-4'
                                : ''
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                              <div className="sm:w-1/3">
                                <p className="font-medium text-gray-700">
                                  {qIndex + 1}. {question.question_text}
                                  {question.is_required && (
                                    <span className="text-camp-orange ml-1">*</span>
                                  )}
                                </p>
                                {question.help_text && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {question.help_text}
                                  </p>
                                )}
                              </div>
                              <div className="sm:w-2/3">
                                {editingQuestion === question.id ? (
                                  <div className="space-y-2">
                                    {/* Render appropriate input based on question type */}
                                    {question.question_type === 'dropdown' && question.options ? (
                                      <select
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent bg-white"
                                        disabled={saving}
                                      >
                                        <option value="">Select an option...</option>
                                        {(Array.isArray(question.options) ? question.options : Object.values(question.options)).map((option: string) => (
                                          <option key={option} value={option}>{option}</option>
                                        ))}
                                      </select>
                                    ) : question.question_type === 'multiple_choice' && question.options ? (
                                      <div className="space-y-2">
                                        {(Array.isArray(question.options) ? question.options : Object.values(question.options)).map((option: string) => (
                                          <label key={option} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                                            <input
                                              type="radio"
                                              name={`edit-${question.id}`}
                                              value={option}
                                              checked={editValue === option}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              disabled={saving}
                                              className="w-4 h-4 text-camp-green focus:ring-camp-green"
                                            />
                                            <span className="text-gray-700">{option}</span>
                                          </label>
                                        ))}
                                      </div>
                                    ) : question.question_type === 'checkbox' && question.options ? (
                                      <div className="space-y-2">
                                        {(Array.isArray(question.options) ? question.options : Object.values(question.options)).map((option: string) => {
                                          const selectedValues = editValue ? editValue.split(', ') : []
                                          return (
                                            <label key={option} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                                              <input
                                                type="checkbox"
                                                value={option}
                                                checked={selectedValues.includes(option)}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setEditValue(selectedValues.length > 0 ? `${editValue}, ${option}` : option)
                                                  } else {
                                                    setEditValue(selectedValues.filter(v => v !== option).join(', '))
                                                  }
                                                }}
                                                disabled={saving}
                                                className="w-4 h-4 text-camp-green focus:ring-camp-green rounded"
                                              />
                                              <span className="text-gray-700">{option}</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    ) : question.question_type === 'date' ? (
                                      <input
                                        type="date"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                                        disabled={saving}
                                      />
                                    ) : question.question_type === 'email' ? (
                                      <input
                                        type="email"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                                        disabled={saving}
                                      />
                                    ) : question.question_type === 'phone' ? (
                                      <input
                                        type="tel"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                                        disabled={saving}
                                      />
                                    ) : question.question_type === 'text' ? (
                                      <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent"
                                        disabled={saving}
                                      />
                                    ) : question.question_type === 'medication_list' ? (
                                      <MedicationList
                                        questionId={question.id}
                                        applicationId={applicationId}
                                        value={editMedications}
                                        onChange={setEditMedications}
                                        medicationFields={(question.options as any)?.medication_fields}
                                        doseFields={(question.options as any)?.dose_fields}
                                        isRequired={question.is_required}
                                      />
                                    ) : question.question_type === 'allergy_list' ? (
                                      <AllergyList
                                        questionId={question.id}
                                        applicationId={applicationId}
                                        value={editAllergies}
                                        onChange={setEditAllergies}
                                        allergyFields={(question.options as any)?.allergy_fields}
                                        isRequired={question.is_required}
                                      />
                                    ) : question.question_type === 'table' ? (
                                      <GenericTable
                                        questionId={question.id}
                                        applicationId={applicationId}
                                        value={editTableData}
                                        onChange={setEditTableData}
                                        columns={(question.options as any)?.columns || []}
                                        addButtonText={(question.options as any)?.addButtonText}
                                        emptyStateText={(question.options as any)?.emptyStateText}
                                        isRequired={question.is_required}
                                      />
                                    ) : (
                                      // Default to textarea for textarea, signature, and other text-based types
                                      <textarea
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent resize-none"
                                        rows={3}
                                        disabled={saving}
                                      />
                                    )}
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveEdit(question.id, question.question_type)}
                                        disabled={saving}
                                        className="bg-camp-green hover:bg-camp-green/90 text-white"
                                      >
                                        {saving ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                              ) : editingFileQuestion === question.id ? (
                                  // File upload editing UI
                                  <div className="bg-gray-50 px-4 py-3 rounded-lg space-y-3">
                                    <div className="text-sm text-gray-600 mb-2">
                                      Upload a new file to replace the current one:
                                    </div>
                                    <input
                                      type="file"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          handleFileUpload(question.id, file)
                                        }
                                      }}
                                      disabled={uploadingFile}
                                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-camp-green file:text-white hover:file:bg-camp-green/90 file:cursor-pointer"
                                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    />
                                    <div className="flex gap-2">
                                      {uploadingFile && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                          </svg>
                                          Uploading...
                                        </div>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingFileQuestion(null)}
                                        disabled={uploadingFile}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                <div className="bg-gray-50 px-4 py-3 rounded-lg group relative">
                                  {value}
                                  {question.question_type !== 'file_upload' && question.question_type !== 'file' ? (
                                    <button
                                      onClick={() => {
                                        const response = application?.responses?.find(r => r.question_id === question.id)
                                        handleStartEdit(question.id, response?.response_value || '', question.question_type)
                                      }}
                                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                                    >
                                      ✏️ Edit
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setEditingFileQuestion(question.id)}
                                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                                    >
                                      📎 Upload New
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Application Metadata */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Application Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Application ID:</span>
                <span className="ml-2 text-gray-600 font-mono text-xs">{application.id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">User ID:</span>
                <span className="ml-2 text-gray-600 font-mono text-xs">{application.user_id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <span className="ml-2 text-gray-600">{formatDateCST(application.created_at)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Last Updated:</span>
                <span className="ml-2 text-gray-600">{formatDateCST(application.updated_at)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Returning Camper:</span>
                <span className="ml-2 text-gray-600">{application.is_returning_camper ? 'Yes' : 'No'}</span>
              </div>
              {application.cabin_assignment && (
                <div>
                  <span className="font-medium text-gray-700">Cabin Assignment:</span>
                  <span className="ml-2 text-gray-600">{application.cabin_assignment}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Approval Section */}
        <div
          ref={adminSectionRef}
          className="scroll-mt-20"
        >
        <Card className="mt-8 border-l-4 border-l-camp-green">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <svg className="w-6 h-6 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Team Approval
            </CardTitle>
            <CardDescription>
              Approve or decline this application. 3 approvals required to move to 'Accepted' status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Approval Counter */}
            {approvalStatus && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-camp-charcoal">Approval Progress</h4>
                    <p className="text-sm text-gray-600">
                      {approvalStatus.approval_count} of 3 approvals received
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{approvalStatus.approval_count}</div>
                      <div className="text-xs text-gray-500">Approved</div>
                    </div>
                    {approvalStatus.decline_count > 0 && (
                      <div className="text-center ml-4">
                        <div className="text-2xl font-bold text-red-600">{approvalStatus.decline_count}</div>
                        <div className="text-xs text-gray-500">Declined</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min((approvalStatus.approval_count / 3) * 100, 100)}%` }}
                  />
                </div>

                {/* Who approved/declined */}
                {approvalStatus.approved_by.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Approved by:</p>
                    <div className="flex flex-wrap gap-2">
                      {approvalStatus.approved_by.map((admin) => {
                        const teamColor = admin.team ? getTeamColor(admin.team) : null
                        return (
                          <span
                            key={admin.admin_id}
                            className="inline-flex items-center px-2 py-1 rounded text-xs"
                            style={admin.team ? getTeamStyle(admin.team) : { backgroundColor: '#D1FAE5', color: '#065F46' }}
                          >
                            {admin.name}
                            {teamColor && <span className="ml-1 font-semibold">({teamColor.name})</span>}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {approvalStatus.declined_by.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">Declined by:</p>
                    <div className="flex flex-wrap gap-2">
                      {approvalStatus.declined_by.map((admin) => {
                        const teamColor = admin.team ? getTeamColor(admin.team) : null
                        return (
                          <span
                            key={admin.admin_id}
                            className="inline-flex items-center px-2 py-1 rounded text-xs"
                            style={admin.team ? getTeamStyle(admin.team) : { backgroundColor: '#FEE2E2', color: '#991B1B' }}
                          >
                            {admin.name}
                            {teamColor && <span className="ml-1 font-semibold">({teamColor.name})</span>}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Prompt */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-3">
                <strong>Note:</strong> Approving or declining requires adding a note explaining your decision.
                Use the floating Admin Panel for all approval actions.
              </p>
              <Button
                onClick={() => setShowAdminPanel(true)}
                className="bg-camp-green hover:bg-camp-green/90 text-white font-semibold px-6 py-2 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Open Admin Panel to Approve/Decline
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Review & Notes */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <svg className="w-6 h-6 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Team Notes
            </CardTitle>
            <CardDescription className="space-y-1">
              <span>Add notes about this application. Notes are visible to all admins.</span>
              <span className="block text-xs text-gray-400 italic">
                Use this section for general or additional notes beyond initial review feedback.
                Examples: follow-up phone calls, updated information from family, post-review observations.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Add Note Form */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add New Note
              </label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note here... (e.g., 'Medical team needs to review medications')"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-camp-green focus:border-transparent resize-none"
                rows={3}
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={handleCreateNote}
                  disabled={notesLoading || !newNote.trim()}
                  className="bg-camp-green hover:bg-camp-green/90 text-white font-medium"
                >
                  {notesLoading ? 'Adding...' : 'Add Note'}
                </Button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-4">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p>No notes yet. Be the first to add a note!</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-camp-green rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {note.admin?.first_name?.[0]}{note.admin?.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-camp-charcoal">
                            {note.admin?.first_name} {note.admin?.last_name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            {note.admin?.team && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                style={getTeamStyle(note.admin.team)}
                              >
                                {getTeamColor(note.admin.team).name}
                              </span>
                            )}
                            <span>{formatDateCST(note.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700 mt-3 ml-13 whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        </div>
        </main>
      </div>

      {/* Floating Missing Questions Navigator */}
      {missingQuestions.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={goToNextMissing}
            className="flex items-center gap-3 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 group"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              {currentMissingIndex === -1
                ? `${missingQuestions.length} Missing`
                : `${currentMissingIndex + 1} of ${missingQuestions.length}`}
            </span>
            <svg
              className="w-4 h-4 group-hover:translate-y-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
          {currentMissingIndex >= 0 && (
            <div className="mt-2 px-3 py-2 bg-white rounded-lg shadow-md text-sm max-w-xs">
              <p className="text-gray-500 text-xs mb-1">
                {missingQuestions[currentMissingIndex].sectionTitle}
              </p>
              <p className="text-gray-800 font-medium truncate">
                {missingQuestions[currentMissingIndex].questionText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floating Admin Action Panel */}
      {application && (
        <AdminActionPanel
          applicationId={applicationId}
          applicationMeta={{
            id: application.id,
            status: application.status,
            sub_status: application.sub_status,
            completion_percentage: application.completion_percentage,
            created_at: application.created_at,
            updated_at: application.updated_at,
            completed_at: application.completed_at,
            is_returning_camper: application.is_returning_camper,
            cabin_assignment: application.cabin_assignment
          }}
          approvalStatus={approvalStatus}
          notes={notes}
          onApprove={handleApprove}
          onDecline={handleDecline}
          onDefer={handleDefer}
          onAccept={handleAccept}
          onAddNote={handleAddNoteFromPanel}
          onEmailClick={openEmailDialog}
          onDeleteClick={openDeleteModal}
          isSuperAdmin={user?.role === 'super_admin'}
          camperName={application.camper_first_name && application.camper_last_name
            ? `${application.camper_first_name} ${application.camper_last_name}`
            : undefined}
          isOpen={showAdminPanel}
          onOpenChange={setShowAdminPanel}
        />
      )}

      {/* Email Family Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Family
            </DialogTitle>
            <DialogDescription>
              Send a direct email to the family associated with this application.
              {application?.camper_first_name && application?.camper_last_name && (
                <span className="block mt-1 font-medium text-camp-charcoal">
                  Camper: {application.camper_first_name} {application.camper_last_name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={emailSending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Message
              </label>
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Write your message here..."
                rows={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={emailSending}
              />
              <p className="text-xs text-gray-500 mt-1.5">
                The email will be sent from apps@fasdcamp.org and will include your branded CAMP email template.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
              disabled={emailSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {emailSending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Application Modal (Super Admin Only) - Multi-step confirmation */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmStep(1)
          setDeleteConfirmText('')
        }
        setShowDeleteModal(open)
      }}>
        <DialogContent className="sm:max-w-[500px] border-red-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Permanently Delete Application
            </DialogTitle>
            <DialogDescription className="text-red-600 font-medium">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteConfirmStep === 1 && (
            <div className="py-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">
                  You are about to permanently delete:
                </h4>
                <div className="bg-white rounded-lg p-3 border border-red-100">
                  <p className="text-lg font-bold text-red-900">
                    {hasCamperName ? deleteConfirmationText : 'Unnamed Application'}
                  </p>
                  <p className="text-sm text-red-700">
                    Status: {application?.status ? getCategoryColor(application.status).label : ''} - {application?.status && application?.sub_status ? getStatusColor(application.status, application.sub_status).label : ''}
                  </p>
                  {!hasCamperName && (
                    <p className="text-xs text-red-500 mt-1">
                      Application ID: {applicationId}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  This will permanently delete:
                </h4>
                <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                  <li>All application responses</li>
                  <li>All uploaded files (documents, photos)</li>
                  <li>All medications and allergies</li>
                  <li>All admin notes</li>
                  <li>All invoices (open invoices will be voided in Stripe)</li>
                </ul>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setDeleteConfirmStep(2)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  I Understand, Continue
                </Button>
              </DialogFooter>
            </div>
          )}

          {deleteConfirmStep === 2 && (
            <div className="py-4 space-y-4">
              <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                <p className="text-red-800 font-medium mb-3">
                  {hasCamperName
                    ? "To confirm deletion, type the camper's full name exactly:"
                    : "To confirm deletion, type DELETE:"}
                </p>
                <div className="bg-white rounded-lg px-4 py-2 border border-red-200 mb-3">
                  <p className="font-mono font-bold text-red-900 text-lg">
                    {deleteConfirmationText}
                  </p>
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={hasCamperName ? "Type the camper's full name..." : "Type DELETE..."}
                  className="w-full px-4 py-3 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
                  disabled={deleting}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmStep(1)}
                  disabled={deleting}
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleDeleteApplication}
                  disabled={deleting || deleteConfirmText !== deleteConfirmationText}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Forever
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
