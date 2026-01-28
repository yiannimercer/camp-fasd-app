'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import {
  getAllEmailTemplates,
  updateEmailTemplate,
  createEmailTemplate,
  getAllEmailAutomations,
  createEmailAutomation,
  updateEmailAutomation,
  deleteEmailAutomation,
  EmailTemplate,
  EmailAutomation,
} from '@/lib/api-super-admin'
import {
  getEmailConfig,
  getEmailLogs,
  getEmailLogStats,
  sendMassEmail,
  getEmailAudience,
  previewEmail,
  getEmailDocuments,
  uploadEmailDocument,
  deleteEmailDocument,
  EmailLog,
  EmailConfig,
  AudienceRecipient,
  EmailDocument,
} from '@/lib/api-emails'
import { MarkdownEmailEditor } from '@/components/email/MarkdownEmailEditor'
import { DocumentsTab } from '@/components/email/DocumentsTab'
import { TemplateEditorDialog } from '@/components/email/TemplateEditorDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle,
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Eye,
  Edit,
  RefreshCw,
  Loader2,
  Plus,
  Zap,
  Calendar,
  Trash2,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Sparkles,
  UserCheck,
  Tent,
  CreditCard,
  Shield,
  Link2
} from 'lucide-react'
import { format } from 'date-fns'
import { ConfirmationModal } from '@/components/shared/ConfirmationModal'

// Trigger event options for event-based automations
// These events are fired from the backend when the corresponding actions occur
const EVENT_TRIGGERS = [
  // Application Lifecycle
  { value: 'application_created', label: 'Application Created', description: 'When a new application is started', category: 'Application' },

  // Applicant Stage Changes
  { value: 'applicant_incomplete', label: 'Applicant → Incomplete', description: 'When applicant starts filling form', category: 'Applicant Stage' },
  { value: 'applicant_complete', label: 'Applicant → Complete', description: 'When application reaches 100%', category: 'Applicant Stage' },
  { value: 'applicant_under_review', label: 'Applicant → Under Review', description: 'When admin starts reviewing', category: 'Applicant Stage' },
  { value: 'applicant_waitlisted', label: 'Applicant → Waitlisted', description: 'When added to waitlist', category: 'Applicant Stage' },

  // Status Promotions/Changes
  { value: 'promoted_to_camper', label: 'Promoted to Camper', description: 'When accepted as a camper', category: 'Status Change' },
  { value: 'application_deactivated', label: 'Application Deactivated', description: 'When application is deactivated', category: 'Status Change' },
  { value: 'application_reactivated', label: 'Application Reactivated', description: 'When application is reactivated', category: 'Status Change' },

  // Camper Stage Changes
  { value: 'camper_incomplete', label: 'Camper → Incomplete', description: 'When post-acceptance sections need completion', category: 'Camper Stage' },
  { value: 'camper_complete', label: 'Camper → Complete', description: 'When all post-acceptance sections complete', category: 'Camper Stage' },

  // Payment Events
  { value: 'payment_received', label: 'Payment Received', description: 'When payment is confirmed', category: 'Payment' },
  { value: 'invoice_generated', label: 'Invoice Generated', description: 'When invoice is created for camper', category: 'Payment' },
  { value: 'payment_plan_created', label: 'Payment Plan Created', description: 'When a payment plan is set up for camper', category: 'Payment' },
  { value: 'scholarship_awarded', label: 'Scholarship Awarded', description: 'When scholarship is granted to camper', category: 'Payment' },

  // Section-based Events
  { value: 'section_completed', label: 'Section Completed', description: 'When any section reaches 100%', category: 'Section' },

  // Admin Actions
  { value: 'admin_note_added', label: 'Admin Note Added', description: 'When admin adds a note to application', category: 'Admin' },
  { value: 'team_approval_added', label: 'Team Approval Added', description: 'When a team approves application', category: 'Admin' },
  { value: 'all_teams_approved', label: 'All Teams Approved', description: 'When all 3 teams have approved', category: 'Admin' },
  { value: 'admin_payment_received', label: 'Admin: Payment Received', description: 'Notify admins when payment is received', category: 'Admin' },
]

// Group events by category for better UI organization
const EVENT_CATEGORIES = [...new Set(EVENT_TRIGGERS.map(e => e.category))]

// Template lifecycle categories with metadata for organized display
const TEMPLATE_CATEGORIES = [
  {
    key: 'application',
    label: 'Application',
    description: 'Initial application and onboarding emails',
    icon: Sparkles,
    color: 'emerald',
    keywords: ['welcome', 'application', 'created', 'started', 'onboard'],
    events: ['application_created'],
  },
  {
    key: 'applicant',
    label: 'Applicant Stage',
    description: 'Emails for applicants progressing through review',
    icon: UserCheck,
    color: 'blue',
    keywords: ['applicant', 'incomplete', 'complete', 'review', 'waitlist'],
    events: ['applicant_incomplete', 'applicant_complete', 'applicant_under_review', 'applicant_waitlisted'],
  },
  {
    key: 'camper',
    label: 'Camper Stage',
    description: 'Post-acceptance camper communications',
    icon: Tent,
    color: 'purple',
    keywords: ['camper', 'accepted', 'promoted', 'camp'],
    events: ['promoted_to_camper', 'camper_incomplete', 'camper_complete'],
  },
  {
    key: 'payment',
    label: 'Payment',
    description: 'Invoice, payment, and scholarship notifications',
    icon: CreditCard,
    color: 'amber',
    keywords: ['payment', 'invoice', 'paid', 'scholarship', 'billing'],
    events: ['payment_received', 'invoice_generated', 'payment_plan_created', 'scholarship_awarded'],
  },
  {
    key: 'admin',
    label: 'Admin & Internal',
    description: 'Administrative digests and internal notifications',
    icon: Shield,
    color: 'slate',
    keywords: ['admin', 'digest', 'internal', 'team', 'approval', 'note'],
    events: ['admin_note_added', 'team_approval_added', 'all_teams_approved', 'admin_payment_received'],
  },
  {
    key: 'other',
    label: 'Other Templates',
    description: 'General and miscellaneous templates',
    icon: FileText,
    color: 'gray',
    keywords: [],
    events: [],
  },
]

// Function to categorize a template based on its key and trigger_event
const categorizeTemplate = (template: EmailTemplate): string => {
  // First, check if trigger_event matches a category
  if (template.trigger_event) {
    for (const cat of TEMPLATE_CATEGORIES) {
      if (cat.events.includes(template.trigger_event)) {
        return cat.key
      }
    }
  }

  // Then check key patterns
  const keyLower = template.key.toLowerCase()
  const nameLower = template.name.toLowerCase()

  for (const cat of TEMPLATE_CATEGORIES) {
    if (cat.keywords.some(kw => keyLower.includes(kw) || nameLower.includes(kw))) {
      return cat.key
    }
  }

  return 'other'
}

// Audience filter options - organized by status category
const AUDIENCE_OPTIONS = [
  // Special
  { value: 'trigger_context', label: 'Trigger Context', description: 'The person who triggered the event', group: 'Special' },
  { value: 'all_admins', label: 'All Admins', filter: { role: 'admin' }, group: 'Special' },

  // Applicants - All stages
  { value: 'all_applicants', label: 'All Applicants', filter: { status: 'applicant' }, group: 'Applicants' },
  { value: 'not_started_applicants', label: 'Not Started', filter: { status: 'applicant', sub_status: 'not_started' }, group: 'Applicants' },
  { value: 'incomplete_applicants', label: 'Incomplete', filter: { status: 'applicant', sub_status: 'incomplete' }, group: 'Applicants' },
  { value: 'complete_applicants', label: 'Complete (Ready for Review)', filter: { status: 'applicant', sub_status: 'complete' }, group: 'Applicants' },
  { value: 'under_review_applicants', label: 'Under Review', filter: { status: 'applicant', sub_status: 'under_review' }, group: 'Applicants' },
  { value: 'waitlist_applicants', label: 'Waitlist', filter: { status: 'applicant', sub_status: 'waitlist' }, group: 'Applicants' },

  // Campers - All stages + payment status
  { value: 'all_campers', label: 'All Campers', filter: { status: 'camper' }, group: 'Campers' },
  { value: 'incomplete_campers', label: 'Incomplete (Post-Acceptance)', filter: { status: 'camper', sub_status: 'incomplete' }, group: 'Campers' },
  { value: 'complete_campers', label: 'Complete (Post-Acceptance)', filter: { status: 'camper', sub_status: 'complete' }, group: 'Campers' },
  { value: 'unpaid_campers', label: 'Unpaid (All)', filter: { status: 'camper', paid_invoice: false }, group: 'Campers' },
  { value: 'paid_campers', label: 'Paid (All)', filter: { status: 'camper', paid_invoice: true }, group: 'Campers' },

  // Inactive - All reasons
  { value: 'all_inactive', label: 'All Inactive', filter: { status: 'inactive' }, group: 'Inactive' },
  { value: 'deferred', label: 'Deferred', filter: { status: 'inactive', sub_status: 'deferred' }, group: 'Inactive' },
  { value: 'withdrawn', label: 'Withdrawn', filter: { status: 'inactive', sub_status: 'withdrawn' }, group: 'Inactive' },
  { value: 'rejected', label: 'Rejected', filter: { status: 'inactive', sub_status: 'rejected' }, group: 'Inactive' },
]

// Days of week options
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

// Hour options in 12hr format
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i
  const ampm = i < 12 ? 'AM' : 'PM'
  return { value: i, label: `${hour12}:00 ${ampm}` }
})

// Helper to get audience label
const getAudienceLabel = (filter: Record<string, any> | null): string => {
  if (!filter || Object.keys(filter).length === 0) return 'Trigger Context'
  const match = AUDIENCE_OPTIONS.find(o => JSON.stringify(o.filter) === JSON.stringify(filter))
  return match?.label || 'Custom Filter'
}

// Helper to get audience value from filter
const getAudienceValue = (filter: Record<string, any> | null): string => {
  if (!filter || Object.keys(filter).length === 0) return 'trigger_context'
  const match = AUDIENCE_OPTIONS.find(o => JSON.stringify(o.filter) === JSON.stringify(filter))
  return match?.value || 'trigger_context'
}

export default function EmailCommunicationPage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  // CRITICAL: Ensure body scroll is restored when template dialog closes
  // This provides defense-in-depth against Radix UI scroll lock issues
  useEffect(() => {
    if (!templateDialogOpen) {
      // Small delay to let dialog animation complete
      const cleanup = setTimeout(() => {
        document.body.style.overflow = ''
        document.body.style.pointerEvents = ''
        document.body.removeAttribute('data-scroll-locked')
      }, 150)
      return () => clearTimeout(cleanup)
    }
  }, [templateDialogOpen])

  // Automations state
  const [automations, setAutomations] = useState<EmailAutomation[]>([])
  const [editingAutomation, setEditingAutomation] = useState<Partial<EmailAutomation> | null>(null)
  const [automationDialogOpen, setAutomationDialogOpen] = useState(false)
  const [isCreatingAutomation, setIsCreatingAutomation] = useState(false)
  const [savingAutomation, setSavingAutomation] = useState(false)

  // Mass email state
  const [massEmailSubject, setMassEmailSubject] = useState('')
  const [massEmailContent, setMassEmailContent] = useState('')
  const [selectedAudience, setSelectedAudience] = useState<string>('')
  const [audienceRecipients, setAudienceRecipients] = useState<AudienceRecipient[]>([])
  const [loadingAudience, setLoadingAudience] = useState(false)
  const [sendingMassEmail, setSendingMassEmail] = useState(false)

  // Preview state
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Logs state
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [logStats, setLogStats] = useState<{ total: number; sent: number; failed: number; last_24h: number; last_7d: number } | null>(null)

  // Config state
  const [config, setConfig] = useState<EmailConfig | null>(null)

  // Documents state
  const [documents, setDocuments] = useState<EmailDocument[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)

  // Confirmation modal state
  const [deleteAutomationModal, setDeleteAutomationModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [sendMassEmailModal, setSendMassEmailModal] = useState(false)

  // Load data
  useEffect(() => {
    if (!token) return
    loadData()
  }, [token])

  const loadData = async () => {
    if (!token) return
    try {
      setLoading(true)
      const [templatesData, automationsData, configData, logsData, statsData] = await Promise.all([
        getAllEmailTemplates(token),
        getAllEmailAutomations(token),
        getEmailConfig(token),
        getEmailLogs(token, { limit: 50 }),
        getEmailLogStats(token),
      ])
      setTemplates(templatesData)
      setAutomations(automationsData)
      setConfig(configData)
      setLogs(logsData)
      setLogStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // ==================== DOCUMENT HANDLERS ====================

  const loadDocuments = async () => {
    if (!token) return
    try {
      setLoadingDocuments(true)
      const docsData = await getEmailDocuments(token)
      setDocuments(docsData)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoadingDocuments(false)
    }
  }

  const handleUploadDocument = async (file: File, name: string, description?: string) => {
    if (!token) throw new Error('Not authenticated')
    await uploadEmailDocument(token, file, name, description)
    await loadDocuments()
    setSuccess('Document uploaded successfully')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!token) throw new Error('Not authenticated')
    await deleteEmailDocument(token, documentId)
    await loadDocuments()
    setSuccess('Document deleted successfully')
    setTimeout(() => setSuccess(''), 3000)
  }

  // ==================== TEMPLATE HANDLERS ====================

  const openEditTemplate = (template: EmailTemplate) => {
    setIsCreatingTemplate(false)
    setEditingTemplate({
      ...template,
      markdown_content: template.markdown_content || '',
      use_markdown: template.use_markdown ?? true,
    })
    setTemplateDialogOpen(true)
    // Pre-load documents for markdown editor
    if (!documents.length) loadDocuments()
  }

  const openCreateTemplate = () => {
    setIsCreatingTemplate(true)
    setEditingTemplate({
      id: '',
      key: '',
      name: '',
      subject: '',
      html_content: '',
      text_content: '',
      markdown_content: '',
      use_markdown: true,  // Default to markdown for new templates
      trigger_event: null,
      variables: [],
      is_active: true,
      created_at: '',
      updated_at: '',
      updated_by: null
    })
    setTemplateDialogOpen(true)
    // Pre-load documents for markdown editor
    if (!documents.length) loadDocuments()
  }

  // Handler for the new template editor dialog
  const handleTemplatePreview = async (
    subject: string,
    content: string,
    isMarkdown: boolean,
    variables: Record<string, string>
  ): Promise<string> => {
    if (!token) throw new Error('Not authenticated')

    const result = await previewEmail(token, subject, content, {
      isMarkdown,
      recipientName: variables.firstName || 'John',
      camperFirstName: variables.camperFirstName || 'Sarah',
      camperLastName: variables.camperLastName || 'Smith',
      variables, // Pass all mock variables to backend
    })
    return result.html
  }

  const handleSaveTemplate = async (templateData: {
    key: string
    name: string
    subject: string
    html_content: string
    text_content?: string | null
    markdown_content?: string | null
    use_markdown?: boolean
    is_active?: boolean
    variables?: string[] | null
  }) => {
    if (!token) throw new Error('Not authenticated')

    try {
      setError('')

      if (isCreatingTemplate) {
        await createEmailTemplate(token, {
          key: templateData.key,
          name: templateData.name,
          subject: templateData.subject,
          html_content: templateData.html_content,
          text_content: templateData.text_content || undefined,
          markdown_content: templateData.markdown_content || undefined,
          use_markdown: templateData.use_markdown || false,
          variables: [],
          is_active: templateData.is_active ?? true,
        })
        setSuccess('Template created successfully')
      } else {
        await updateEmailTemplate(token, templateData.key, {
          name: templateData.name,
          subject: templateData.subject,
          html_content: templateData.html_content,
          text_content: templateData.text_content || undefined,
          markdown_content: templateData.markdown_content || undefined,
          use_markdown: templateData.use_markdown || false,
          is_active: templateData.is_active,
        })
        setSuccess('Template updated successfully')
      }

      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
      throw err // Re-throw so the dialog knows it failed
    }
  }

  // ==================== AUTOMATION HANDLERS ====================

  const openEditAutomation = (automation: EmailAutomation) => {
    setIsCreatingAutomation(false)
    setEditingAutomation({ ...automation })
    setAutomationDialogOpen(true)
  }

  const openCreateAutomation = () => {
    setIsCreatingAutomation(true)
    setEditingAutomation({
      name: '',
      description: '',
      template_key: templates[0]?.key || '',
      trigger_type: 'event',
      trigger_event: 'application_created',
      schedule_day: 1,
      schedule_hour: 9,
      audience_filter: {},
      is_active: true,
    })
    setAutomationDialogOpen(true)
  }

  const handleSaveAutomation = async () => {
    if (!token || !editingAutomation) return
    try {
      setSavingAutomation(true)
      setError('')

      if (isCreatingAutomation) {
        await createEmailAutomation(token, {
          name: editingAutomation.name!,
          description: editingAutomation.description || undefined,
          template_key: editingAutomation.template_key!,
          trigger_type: editingAutomation.trigger_type as 'event' | 'scheduled',
          trigger_event: editingAutomation.trigger_type === 'event' ? editingAutomation.trigger_event || undefined : undefined,
          schedule_day: editingAutomation.trigger_type === 'scheduled' ? editingAutomation.schedule_day || undefined : undefined,
          schedule_hour: editingAutomation.trigger_type === 'scheduled' ? editingAutomation.schedule_hour || undefined : undefined,
          audience_filter: editingAutomation.audience_filter || {},
          is_active: editingAutomation.is_active,
        })
        setSuccess('Automation created successfully')
      } else {
        await updateEmailAutomation(token, editingAutomation.id!, {
          name: editingAutomation.name,
          description: editingAutomation.description || undefined,
          template_key: editingAutomation.template_key,
          trigger_type: editingAutomation.trigger_type as 'event' | 'scheduled',
          trigger_event: editingAutomation.trigger_event || undefined,
          schedule_day: editingAutomation.schedule_day ?? undefined,
          schedule_hour: editingAutomation.schedule_hour ?? undefined,
          audience_filter: editingAutomation.audience_filter || {},
          is_active: editingAutomation.is_active,
        })
        setSuccess('Automation updated successfully')
      }

      setAutomationDialogOpen(false)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save automation')
    } finally {
      setSavingAutomation(false)
    }
  }

  const showDeleteAutomationConfirm = (automationId: string) => {
    setDeleteAutomationModal({ open: true, id: automationId })
  }

  const executeDeleteAutomation = async () => {
    if (!token || !deleteAutomationModal.id) return

    try {
      await deleteEmailAutomation(token, deleteAutomationModal.id)
      setSuccess('Automation deleted successfully')
      setDeleteAutomationModal({ open: false, id: null })
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete automation')
    }
  }

  const handleToggleAutomation = async (automation: EmailAutomation) => {
    if (!token) return
    try {
      await updateEmailAutomation(token, automation.id, { is_active: !automation.is_active })
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle automation')
    }
  }

  // ==================== MASS EMAIL HANDLERS ====================

  const loadAudience = async (audienceValue: string) => {
    if (!token || !audienceValue) {
      setAudienceRecipients([])
      return
    }

    const option = AUDIENCE_OPTIONS.find(o => o.value === audienceValue)
    if (!option?.filter) {
      setAudienceRecipients([])
      return
    }

    try {
      setLoadingAudience(true)
      const response = await getEmailAudience(token, {
        status: option.filter.status,
        sub_status: option.filter.sub_status,
        paid: option.filter.paid_invoice,
      })
      setAudienceRecipients(response.recipients)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audience')
    } finally {
      setLoadingAudience(false)
    }
  }

  useEffect(() => {
    if (selectedAudience) {
      loadAudience(selectedAudience)
    }
  }, [selectedAudience])

  const handlePreviewMassEmail = async () => {
    if (!token || !massEmailContent) return
    try {
      setLoadingPreview(true)
      // Use first recipient's data for preview, or sample data if none selected
      const sampleRecipient = audienceRecipients[0]
      const camperParts = sampleRecipient?.camper_name?.split(' ') || ['Sarah', 'Smith']
      const result = await previewEmail(token, massEmailSubject, massEmailContent, {
        recipientName: sampleRecipient?.name?.split(' ')[0] || 'John',
        camperFirstName: camperParts[0] || 'Sarah',
        camperLastName: camperParts.slice(1).join(' ') || 'Smith',
      })
      setPreviewHtml(result.html)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const showSendMassEmailConfirm = () => {
    if (audienceRecipients.length === 0) return
    setSendMassEmailModal(true)
  }

  const executeSendMassEmail = async () => {
    if (!token || audienceRecipients.length === 0) return
    setSendMassEmailModal(false)

    try {
      setSendingMassEmail(true)
      const result = await sendMassEmail(token, {
        subject: massEmailSubject,
        html_content: massEmailContent,
        recipients: audienceRecipients.map(r => {
          const camperParts = r.camper_name?.split(' ') || []
          return {
            email: r.email,
            name: r.name,
            user_id: r.user_id,
            application_id: r.application_id,
            variables: {
              camperName: r.camper_name || '',
              camperFirstName: camperParts[0] || '',
              camperLastName: camperParts.slice(1).join(' ') || '',
            },
          }
        }),
      })

      if (result.failed_count > 0) {
        setSuccess(`Sent ${result.sent_count} emails (${result.failed_count} failed)`)
      } else {
        setSuccess(`Successfully sent ${result.sent_count} emails`)
      }
      setMassEmailSubject('')
      setMassEmailContent('')
      setSelectedAudience('')
      setAudienceRecipients([])
      setPreviewHtml('')
      loadData()
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send mass email')
    } finally {
      setSendingMassEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Communication</h1>
          <p className="text-muted-foreground mt-1">
            Manage email templates, automations, and send communications
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">Email templates available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Automations</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{automations.filter(a => a.is_active).length}</div>
            <p className="text-xs text-muted-foreground">of {automations.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent (24h)</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logStats?.last_24h || 0}</div>
            <p className="text-xs text-muted-foreground">{logStats?.last_7d || 0} in last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logStats?.total ? Math.round((logStats.sent / logStats.total) * 100) : 100}%
            </div>
            <p className="text-xs text-muted-foreground">{logStats?.failed || 0} failed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="automations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automations
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2" onClick={() => !documents.length && loadDocuments()}>
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="mass-email" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mass Email
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* ==================== AUTOMATIONS TAB ==================== */}
        <TabsContent value="automations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Email Automations</CardTitle>
                  <CardDescription>
                    Configure when emails are automatically sent and to whom. Automations determine the WHEN and WHO.
                  </CardDescription>
                </div>
                <Button onClick={openCreateAutomation}>
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {automations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No automations configured. Create one to get started.
                  </div>
                ) : (
                  automations.map((automation) => (
                    <div
                      key={automation.id}
                      className={`border rounded-lg p-4 ${automation.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{automation.name}</h4>
                            <Badge variant={automation.is_active ? 'default' : 'secondary'}>
                              {automation.is_active ? 'Active' : 'Paused'}
                            </Badge>
                            <Badge variant="outline">
                              {automation.trigger_type === 'event' ? 'Event-based' : 'Scheduled'}
                            </Badge>
                          </div>
                          {automation.description && (
                            <p className="text-sm text-muted-foreground mt-1">{automation.description}</p>
                          )}
                          <div className="mt-2 text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-4">
                              <span>
                                <strong>Template:</strong> {automation.template_name || automation.template_key}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                              {automation.trigger_type === 'event' ? (
                                <span>
                                  <strong>Trigger:</strong>{' '}
                                  {EVENT_TRIGGERS.find(t => t.value === automation.trigger_event)?.label || automation.trigger_event || 'Not set'}
                                  {EVENT_TRIGGERS.find(t => t.value === automation.trigger_event)?.category && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({EVENT_TRIGGERS.find(t => t.value === automation.trigger_event)?.category})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <>
                                  <span>
                                    <strong>Schedule:</strong>{' '}
                                    {DAYS_OF_WEEK.find(d => d.value === automation.schedule_day)?.label} at{' '}
                                    {HOUR_OPTIONS.find(h => h.value === automation.schedule_hour)?.label}
                                    <span className="text-xs text-muted-foreground ml-1">(Central)</span>
                                  </span>
                                  {automation.last_sent_at && (
                                    <span className="text-green-600">
                                      <strong>Last sent:</strong>{' '}
                                      {format(new Date(automation.last_sent_at), 'MMM d, yyyy h:mm a')}
                                    </span>
                                  )}
                                  {!automation.last_sent_at && automation.is_active && (
                                    <span className="text-amber-600">
                                      <strong>Last sent:</strong> Never
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <div>
                              <strong>Audience:</strong> {getAudienceLabel(automation.audience_filter)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleAutomation(automation)}
                            title={automation.is_active ? 'Pause' : 'Activate'}
                          >
                            {automation.is_active ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditAutomation(automation)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => showDeleteAutomationConfirm(automation.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TEMPLATES TAB ==================== */}
        <TabsContent value="templates" className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Email Templates</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage email content organized by applicant lifecycle. Templates define WHAT is sent.
              </p>
            </div>
            <Button onClick={openCreateTemplate} className="bg-camp-green hover:bg-camp-green/90">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>

          {/* Category Sections */}
          <div className="space-y-4">
            {TEMPLATE_CATEGORIES.map((category) => {
              const categoryTemplates = templates.filter(t => categorizeTemplate(t) === category.key)
              if (categoryTemplates.length === 0) return null

              const CategoryIcon = category.icon
              const colorMap: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
                emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
                blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
                purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
                amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
                slate: { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'text-slate-600', badge: 'bg-slate-100 text-slate-700' },
                gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600', badge: 'bg-gray-100 text-gray-700' },
              }
              const colors = colorMap[category.color] || colorMap.gray

              return (
                <details key={category.key} className="group" open>
                  <summary className={`flex items-center gap-3 p-4 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer hover:shadow-sm transition-shadow list-none`}>
                    <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90" />
                    <div className={`p-2 rounded-lg ${colors.badge}`}>
                      <CategoryIcon className={`h-5 w-5 ${colors.icon}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{category.label}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 text-gray-600 border border-gray-200">
                          {categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{category.description}</p>
                    </div>
                  </summary>

                  <div className="mt-3 ml-7 space-y-2">
                    {categoryTemplates.map((template) => {
                      // Find automations using this template
                      const linkedAutomations = automations.filter(a => a.template_key === template.key)

                      return (
                        <div
                          key={template.id}
                          className={`relative border rounded-lg p-4 transition-all hover:shadow-sm ${
                            template.is_active
                              ? 'bg-white border-gray-200'
                              : 'bg-gray-50/50 border-gray-100'
                          }`}
                        >
                          {/* Inactive overlay indicator */}
                          {!template.is_active && (
                            <div className="absolute top-3 right-3">
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600 font-medium">
                                Inactive
                              </span>
                            </div>
                          )}

                          <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Template name and key */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={`font-medium ${template.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {template.name}
                                </h4>
                                <code className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                                  {template.key}
                                </code>
                              </div>

                              {/* Subject line */}
                              <p className={`text-sm mt-1 truncate ${template.is_active ? 'text-gray-600' : 'text-gray-400'}`}>
                                <span className="text-gray-400">Subject:</span> {template.subject}
                              </p>

                              {/* Linked automations */}
                              {linkedAutomations.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Link2 className="h-3.5 w-3.5 text-gray-400" />
                                  {linkedAutomations.map(auto => (
                                    <span
                                      key={auto.id}
                                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                        auto.is_active
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      <Zap className="h-3 w-3" />
                                      {auto.name}
                                      {!auto.is_active && <span className="opacity-60">(paused)</span>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Edit button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditTemplate(template)}
                              className="shrink-0"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="ml-1.5 hidden sm:inline">Edit</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>

          {/* Empty state */}
          {templates.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500 text-center">No templates yet. Create your first email template to get started.</p>
                <Button onClick={openCreateTemplate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== DOCUMENTS TAB ==================== */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Documents</CardTitle>
              <CardDescription>
                Upload documents that can be linked in email templates using markdown syntax.
                These are stored securely and can be referenced in any template.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsTab
                documents={documents}
                isLoading={loadingDocuments}
                onUpload={handleUploadDocument}
                onDelete={handleDeleteDocument}
                onRefresh={loadDocuments}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== MASS EMAIL TAB ==================== */}
        <TabsContent value="mass-email" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Compose Mass Email</CardTitle>
                <CardDescription>Send a custom email to a selected audience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select value={selectedAudience} onValueChange={setSelectedAudience}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience..." />
                    </SelectTrigger>
                    <SelectContent>
                      {['Applicants', 'Campers', 'Inactive', 'Special'].map((group) => (
                        <SelectGroup key={group}>
                          <SelectLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group}</SelectLabel>
                          {AUDIENCE_OPTIONS
                            .filter(o => o.filter && o.group === group)
                            .map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingAudience && (
                    <p className="text-sm text-muted-foreground">Loading recipients...</p>
                  )}
                  {audienceRecipients.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">
                        {audienceRecipients.length} recipients selected
                      </p>
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          <span className="group-open:rotate-90 transition-transform">▶</span>
                          View recipient list
                        </summary>
                        <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y divide-gray-100">
                          {audienceRecipients.map((recipient) => (
                            <div key={recipient.email} className="px-3 py-2 text-sm hover:bg-gray-50">
                              <div className="font-medium text-gray-900">{recipient.name}</div>
                              <div className="text-xs text-gray-500 flex gap-3">
                                <span>{recipient.email}</span>
                                {recipient.camper_name && (
                                  <span className="text-gray-400">• Camper: {recipient.camper_name}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={massEmailSubject}
                    onChange={(e) => setMassEmailSubject(e.target.value)}
                    placeholder="Email subject..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Message Content</Label>
                  <Textarea
                    id="content"
                    value={massEmailContent}
                    onChange={(e) => setMassEmailContent(e.target.value)}
                    placeholder="Write your email message..."
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{camperName}}'}, {'{{camperFirstName}}'}, {'{{camperLastName}}'}, {'{{campYear}}'}, {'{{appUrl}}'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePreviewMassEmail}
                    disabled={!massEmailContent || loadingPreview}
                  >
                    {loadingPreview ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Preview
                  </Button>
                  <Button
                    onClick={showSendMassEmailConfirm}
                    disabled={!massEmailSubject || !massEmailContent || audienceRecipients.length === 0 || sendingMassEmail}
                    className="bg-camp-green hover:bg-camp-green/90"
                  >
                    {sendingMassEmail ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send to {audienceRecipients.length} Recipients
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>How your email will appear</CardDescription>
              </CardHeader>
              <CardContent>
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-96 border rounded"
                    title="Email Preview"
                  />
                ) : (
                  <div className="h-96 border rounded flex items-center justify-center text-muted-foreground">
                    Click Preview to see how your email will look
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== LOGS TAB ==================== */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Logs</CardTitle>
              <CardDescription>Recent email activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No email logs found</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{log.recipient_email}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.subject || 'No subject'} • {log.template_used || 'Custom'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                          {log.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : '—'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== AUTOMATION DIALOG ==================== */}
      <Dialog open={automationDialogOpen} onOpenChange={setAutomationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isCreatingAutomation ? 'Create Automation' : 'Edit Automation'}</DialogTitle>
            <DialogDescription>
              Configure when this email is automatically sent and to whom
            </DialogDescription>
          </DialogHeader>

          {editingAutomation && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="automation-name">Name</Label>
                  <Input
                    id="automation-name"
                    value={editingAutomation.name || ''}
                    onChange={(e) => setEditingAutomation({ ...editingAutomation, name: e.target.value })}
                    placeholder="e.g., Welcome Email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="automation-template">Template</Label>
                  <Select
                    value={editingAutomation.template_key || ''}
                    onValueChange={(value) => setEditingAutomation({ ...editingAutomation, template_key: value })}
                  >
                    <SelectTrigger id="automation-template">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.filter((t) => t.is_active).map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="automation-description">Description (optional)</Label>
                <Input
                  id="automation-description"
                  value={editingAutomation.description || ''}
                  onChange={(e) => setEditingAutomation({ ...editingAutomation, description: e.target.value })}
                  placeholder="Brief description of this automation"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Trigger Type</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingAutomation.trigger_type === 'event'}
                      onChange={() => setEditingAutomation({ ...editingAutomation, trigger_type: 'event' })}
                    />
                    <span>Event-based</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingAutomation.trigger_type === 'scheduled'}
                      onChange={() => setEditingAutomation({ ...editingAutomation, trigger_type: 'scheduled' })}
                    />
                    <span>Scheduled (recurring)</span>
                  </label>
                </div>
              </div>

              {editingAutomation.trigger_type === 'event' ? (
                <div className="space-y-2">
                  <Label>Trigger Event</Label>
                  <Select
                    value={editingAutomation.trigger_event || ''}
                    onValueChange={(value) => setEditingAutomation({ ...editingAutomation, trigger_event: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select event..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {EVENT_CATEGORIES.map((category) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                            {category}
                          </div>
                          {EVENT_TRIGGERS.filter(t => t.category === category).map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              <div className="flex flex-col">
                                <span>{t.label}</span>
                                <span className="text-xs text-muted-foreground">{t.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Events are fired automatically when the corresponding action occurs in the system
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Day of Week</Label>
                      <Select
                        value={String(editingAutomation.schedule_day ?? 1)}
                        onValueChange={(value) => setEditingAutomation({ ...editingAutomation, schedule_day: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((d) => (
                            <SelectItem key={d.value} value={String(d.value)}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Time (Central)</Label>
                      <Select
                        value={String(editingAutomation.schedule_hour ?? 9)}
                        onValueChange={(value) => setEditingAutomation({ ...editingAutomation, schedule_hour: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((h) => (
                            <SelectItem key={h.value} value={String(h.value)}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Times are in Central Time (Chicago). CST/CDT transitions are handled automatically.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={getAudienceValue(editingAutomation.audience_filter || null)}
                  onValueChange={(value) => {
                    const option = AUDIENCE_OPTIONS.find(o => o.value === value)
                    setEditingAutomation({
                      ...editingAutomation,
                      audience_filter: option?.filter || {}
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Special', 'Applicants', 'Campers', 'Inactive'].map((group) => (
                      <SelectGroup key={group}>
                        <SelectLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group}</SelectLabel>
                        {AUDIENCE_OPTIONS
                          .filter(o => o.group === group)
                          .map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label} {option.description && `- ${option.description}`}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  For event-based triggers, "Trigger Context" sends to the person who triggered the event
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingAutomation.is_active ?? true}
                  onCheckedChange={(checked) => setEditingAutomation({ ...editingAutomation, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAutomationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAutomation} disabled={savingAutomation}>
              {savingAutomation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingAutomation ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== TEMPLATE DIALOG ==================== */}
      <TemplateEditorDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        template={editingTemplate}
        isCreating={isCreatingTemplate}
        onSave={handleSaveTemplate}
        onPreview={handleTemplatePreview}
        documents={documents.map(d => ({
          id: d.id,
          name: d.name,
          url: d.url || '',
        }))}
        onLoadDocuments={loadDocuments}
        automations={automations.map(a => ({
          id: a.id,
          name: a.name,
          template_key: a.template_key,
          is_active: a.is_active,
        }))}
      />

      {/* Delete Automation Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteAutomationModal.open}
        onClose={() => setDeleteAutomationModal({ open: false, id: null })}
        onConfirm={executeDeleteAutomation}
        title="Delete Automation"
        message={
          <>
            Are you sure you want to delete this automation?
            <div className="mt-3 p-3 bg-red-50 rounded-lg text-xs text-red-800">
              <p>This action cannot be undone. Emails will no longer be sent automatically for this trigger.</p>
            </div>
          </>
        }
        confirmLabel="Delete Automation"
        theme="danger"
      />

      {/* Send Mass Email Confirmation Modal */}
      <ConfirmationModal
        isOpen={sendMassEmailModal}
        onClose={() => setSendMassEmailModal(false)}
        onConfirm={executeSendMassEmail}
        title="Send Mass Email"
        message={
          <>
            Are you sure you want to send this email to{' '}
            <span className="font-semibold">{audienceRecipients.length} recipients</span>?
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
              <p className="font-medium mb-1">Please double-check:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Subject: {massEmailSubject || '(not set)'}</li>
                <li>Recipients: {audienceRecipients.length} users</li>
                <li>Emails will be sent immediately</li>
              </ul>
            </div>
          </>
        }
        confirmLabel="Send Emails"
        theme="info"
      />
    </div>
  )
}
