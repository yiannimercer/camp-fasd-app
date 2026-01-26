/**
 * Application Wizard Page
 * Dynamic multi-section form with sidebar navigation
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useToast } from '@/components/shared/ToastNotification'
import {
  getApplicationSections,
  getApplicationProgress,
  getApplication,
  updateApplication,
  ApplicationSection,
  ApplicationProgress,
  ApplicationResponse,
  SectionHeader,
  ApplicationQuestion
} from '@/lib/api-applications'
import { uploadFile, deleteFile, getFile, getFilesBatch, getTemplateFile, FileInfo } from '@/lib/api-files'
// Medication/allergy APIs disabled - data now saves as JSON in main responses
// import { getMedicationsForQuestion, saveMedicationsForQuestion, getAllergiesForQuestion, saveAllergiesForQuestion } from '@/lib/api-medications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import ProfileHeader from '@/components/ProfileHeader'
import MedicationList, { Medication } from '@/components/MedicationList'
import AllergyList, { Allergy } from '@/components/AllergyList'
import GenericTable, { TableRow } from '@/components/GenericTable'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

export default function ApplicationWizardPage() {
  const params = useParams()
  const router = useRouter()
  const { token, user } = useAuth()
  const toast = useToast()
  const applicationId = params.id as string

  const [sections, setSections] = useState<ApplicationSection[]>([])
  const [progress, setProgress] = useState<ApplicationProgress | null>(null)

  // Initialize section from localStorage for this specific application
  const [currentSectionIndex, setCurrentSectionIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`app_section_${applicationId}`)
      return saved ? parseInt(saved, 10) : 0
    }
    return 0
  })
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, FileInfo>>({})
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState<string>('')
  const [camperFirstName, setCamperFirstName] = useState<string>('')
  const [camperLastName, setCamperLastName] = useState<string>('')
  const [camperSex, setCamperSex] = useState<string>('')
  const [camperDateOfBirth, setCamperDateOfBirth] = useState<string>('')
  const [profilePictureUrl, setProfilePictureUrl] = useState<string>('')
  const [medications, setMedications] = useState<Record<string, Medication[]>>({}) // questionId -> medications
  const [allergies, setAllergies] = useState<Record<string, Allergy[]>>({}) // questionId -> allergies
  const [tableData, setTableData] = useState<Record<string, TableRow[]>>({}) // questionId -> table rows
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null) // Track which upload area is being dragged over

  // Find Missing Questions feature - helps users locate unanswered required questions
  const [sectionMissingQuestions, setSectionMissingQuestions] = useState<Array<{
    questionId: string
    questionText: string
    questionNumber: number
  }>>([])
  const [currentMissingIndex, setCurrentMissingIndex] = useState(-1)
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null)
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Track unsaved changes for immediate save on page unload
  const hasUnsavedChanges = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // CRITICAL: Track latest responses in a ref to avoid React async state timing issues
  // When user clicks Save & Exit immediately after a change, React's setState may not have
  // processed yet, so we need a synchronously-updated ref to ensure we save the latest data
  const responsesRef = useRef<Record<string, string>>({})

  // Save current section to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`app_section_${applicationId}`, currentSectionIndex.toString())
    }
  }, [currentSectionIndex, applicationId])

  // Scroll to top when section changes (for better UX when navigating between sections)
  useEffect(() => {
    // Only scroll if not the initial load (sections are loaded)
    if (sections.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentSectionIndex])

  // Load sections, progress, and existing responses
  useEffect(() => {
    if (!token) return

    const loadData = async () => {
      try {
        console.log('Loading application data...', { token: !!token, applicationId })

        const [sectionsData, progressData, applicationData] = await Promise.all([
          getApplicationSections(token, applicationId).catch(err => {
            console.error('Failed to load sections:', err)
            throw new Error(`Failed to load sections: ${err.message}`)
          }),
          getApplicationProgress(token, applicationId).catch(err => {
            console.error('Failed to load progress:', err)
            throw new Error(`Failed to load progress: ${err.message}`)
          }),
          getApplication(token, applicationId).catch(err => {
            console.error('Failed to load application:', err)
            throw new Error(`Failed to load application: ${err.message}`)
          })
        ])

        console.log('Data loaded successfully:', {
          sectionsCount: sectionsData.length,
          progressData,
          applicationStatus: applicationData.status
        })
        setSections(sectionsData)
        setProgress(progressData)

        // Validate the saved section index is within bounds
        if (currentSectionIndex >= sectionsData.length) {
          setCurrentSectionIndex(0)
        }

        // Transform responses array to Record<string, string>
        const responsesMap: Record<string, string> = {}
        const filesMap: Record<string, FileInfo> = {}

        if (applicationData.responses && applicationData.responses.length > 0) {
          console.log('Loading responses:', applicationData.responses)

          // Collect all file IDs that need to be loaded
          const fileResponses = applicationData.responses.filter(r => r.file_id)
          const fileIds = fileResponses.map(r => String(r.file_id))

          // Load all files in a single batch request (much faster!)
          if (fileIds.length > 0) {
            try {
              console.log(`Loading ${fileIds.length} files in batch...`)
              const fileInfos = await getFilesBatch(token, fileIds)
              console.log(`Batch loaded ${fileInfos.length} files successfully`)

              // Map file info to question IDs
              fileResponses.forEach(r => {
                const fileIdStr = String(r.file_id)
                const questionIdStr = String(r.question_id)
                const fileInfo = fileInfos.find(f => f.id === fileIdStr)

                if (fileInfo) {
                  filesMap[questionIdStr] = fileInfo
                  responsesMap[questionIdStr] = fileIdStr
                } else {
                  // Create placeholder if file not found in batch
                  filesMap[questionIdStr] = {
                    id: fileIdStr,
                    filename: 'Uploaded file',
                    size: 0,
                    content_type: 'application/octet-stream',
                    url: '#',
                    created_at: new Date().toISOString()
                  }
                  responsesMap[questionIdStr] = fileIdStr
                }
              })
            } catch (error) {
              console.error('Failed to batch load files:', error)
              // Fallback: create placeholders for all files
              fileResponses.forEach(r => {
                const fileIdStr = String(r.file_id)
                const questionIdStr = String(r.question_id)
                filesMap[questionIdStr] = {
                  id: fileIdStr,
                  filename: 'Uploaded file',
                  size: 0,
                  content_type: 'application/octet-stream',
                  url: '#',
                  created_at: new Date().toISOString()
                }
                responsesMap[questionIdStr] = fileIdStr
              })
            }
          }

          // Load text responses (use String() to ensure consistent key format)
          applicationData.responses.forEach(r => {
            if (r.response_value && !r.file_id) {
              responsesMap[String(r.question_id)] = r.response_value
            }
          })

          console.log('Final responsesMap:', responsesMap)
          console.log('Final filesMap:', filesMap)
        }

        setResponses(responsesMap)
        responsesRef.current = responsesMap  // Keep ref in sync
        setUploadedFiles(filesMap)

        // Extract camper name and profile picture for ProfileHeader
        sectionsData.forEach(section => {
          section.questions.forEach(question => {
            const questionId = String(question.id);  // Ensure string for consistent key lookup
            const response = responsesMap[questionId];

            // Look for first name (case-insensitive)
            if (question.question_text.toLowerCase().includes('first name') &&
                question.question_text.toLowerCase().includes('camper') &&
                response) {
              setCamperFirstName(response);
            }

            // Look for last name (case-insensitive)
            if (question.question_text.toLowerCase().includes('last name') &&
                question.question_text.toLowerCase().includes('camper') &&
                response) {
              setCamperLastName(response);
            }

            // Look for sex (legal sex, not gender identity)
            // Match "Legal Sex" exactly to avoid matching "sexual behavior" questions
            if (question.question_text.toLowerCase() === 'legal sex' && response) {
              setCamperSex(response);
            }

            // Look for date of birth
            if (question.question_text.toLowerCase() === 'date of birth' && response) {
              setCamperDateOfBirth(response);
            }

            // Look for profile picture
            if (question.question_type === 'profile_picture' && filesMap[questionId]) {
              setProfilePictureUrl(filesMap[questionId].url);
            }

            // Load medications from JSON responses
            if (question.question_type === 'medication_list') {
              try {
                const medsData = responsesMap[questionId]
                  ? JSON.parse(responsesMap[questionId])
                  : [];
                setMedications(prev => ({ ...prev, [questionId]: medsData }));
              } catch (err) {
                console.error('Failed to parse medications for question', questionId, err);
                setMedications(prev => ({ ...prev, [questionId]: [] }));
              }
            }

            // Load allergies from JSON responses
            if (question.question_type === 'allergy_list') {
              try {
                const allergyData = responsesMap[questionId]
                  ? JSON.parse(responsesMap[questionId])
                  : [];
                setAllergies(prev => ({ ...prev, [questionId]: allergyData }));
              } catch (err) {
                console.error('Failed to parse allergies for question', questionId, err);
                setAllergies(prev => ({ ...prev, [questionId]: [] }));
              }
            }

            // Load table data for table questions
            if (question.question_type === 'table') {
              try {
                const tableDataValue = responsesMap[questionId]
                  ? JSON.parse(responsesMap[questionId])
                  : [];
                setTableData(prev => ({ ...prev, [questionId]: tableDataValue }));
              } catch (err) {
                console.error('Failed to parse table data for question', questionId, err);
                setTableData(prev => ({ ...prev, [questionId]: [] }));
              }
            }
          });
        });
      } catch (err) {
        console.error('Failed to load application data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load application')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token, applicationId])

  // Aggressive autosave - triggers 500ms after user stops typing
  useEffect(() => {
    if (!token || Object.keys(responses).length === 0) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Mark that we have unsaved changes
    hasUnsavedChanges.current = true

    // Set new timeout for autosave - 500ms for much better UX
    saveTimeoutRef.current = setTimeout(async () => {
      await saveResponses()
      hasUnsavedChanges.current = false
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [responses, token])

  // Save on page unload/refresh to prevent data loss
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current && token) {
        // Try to save synchronously (note: this may not always work in modern browsers)
        saveResponses()

        // Show browser warning if there are unsaved changes
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Save any pending changes when component unmounts
      if (hasUnsavedChanges.current && token) {
        saveResponses()
      }
    }
  }, [token])

  // DISABLED: Medications and allergies now save via the main responses autosave
  // The separate API endpoints were causing 401 errors
  // useEffect(() => {
  //   if (!token || Object.keys(medications).length === 0) return
  //   const timer = setTimeout(async () => {
  //     await saveMedicationsData()
  //   }, 3000)
  //   return () => clearTimeout(timer)
  // }, [medications, token])

  // useEffect(() => {
  //   if (!token || Object.keys(allergies).length === 0) return
  //   const timer = setTimeout(async () => {
  //     await saveAllergiesData()
  //   }, 3000)
  //   return () => clearTimeout(timer)
  // }, [allergies, token])

  // DISABLED: Table data now saves via the main responses autosave
  // useEffect(() => {
  //   if (!token || Object.keys(tableData).length === 0) return
  //   const timer = setTimeout(async () => {
  //     await saveTableData()
  //   }, 3000)
  //   return () => clearTimeout(timer)
  // }, [tableData, token])

  const saveResponses = async () => {
    if (!token) return

    setSaving(true)
    try {
      // CRITICAL: Use responsesRef.current instead of responses state
      // React's setState is async, so if user clicks Save & Exit immediately after a change,
      // the state might not be updated yet. The ref is updated synchronously in handleResponseChange.
      const currentResponses = responsesRef.current
      const responseArray: ApplicationResponse[] = Object.entries(currentResponses).map(([questionId, value]) => {
        // Check if this is a file upload response (value is a UUID/file_id)
        const isFileUpload = uploadedFiles[questionId] !== undefined

        if (isFileUpload) {
          return {
            question_id: questionId,
            file_id: value
          }
        } else {
          return {
            question_id: questionId,
            response_value: value
          }
        }
      })

      await updateApplication(token, applicationId, {
        camper_first_name: camperFirstName || undefined,
        camper_last_name: camperLastName || undefined,
        responses: responseArray
      })

      // Refresh progress
      const progressData = await getApplicationProgress(token, applicationId)
      setProgress(progressData)
    } catch (error) {
      console.error('Autosave failed:', error)
    } finally {
      setSaving(false)
    }
  }

  // DISABLED: These functions are no longer needed - data saves via responses autosave
  // const saveMedicationsData = async () => {
  //   if (!token) return
  //   setSaving(true)
  //   try {
  //     const savePromises = Object.entries(medications).map(([questionId, meds]) =>
  //       saveMedicationsForQuestion(applicationId, questionId, meds)
  //     )
  //     await Promise.all(savePromises)
  //     const progressData = await getApplicationProgress(token, applicationId)
  //     setProgress(progressData)
  //   } catch (error) {
  //     console.error('Medications autosave failed:', error)
  //   } finally {
  //     setSaving(false)
  //   }
  // }

  // const saveAllergiesData = async () => {
  //   if (!token) return
  //   setSaving(true)
  //   try {
  //     const savePromises = Object.entries(allergies).map(([questionId, allergyList]) =>
  //       saveAllergiesForQuestion(applicationId, questionId, allergyList)
  //     )
  //     await Promise.all(savePromises)
  //     const progressData = await getApplicationProgress(token, applicationId)
  //     setProgress(progressData)
  //   } catch (error) {
  //     console.error('Allergies autosave failed:', error)
  //   } finally {
  //     setSaving(false)
  //   }
  // }

  // const saveTableData = async () => {
  //   if (!token) return
  //   setSaving(true)
  //   try {
  //     const tableResponses: Record<string, string> = {}
  //     Object.entries(tableData).forEach(([questionId, rows]) => {
  //       tableResponses[questionId] = JSON.stringify(rows)
  //     })
  //     const updatedResponses = { ...responses, ...tableResponses }
  //     const responseArray: ApplicationResponse[] = Object.entries(updatedResponses).map(([questionId, value]) => ({
  //       question_id: questionId,
  //       response_value: value
  //     }))
  //     await updateApplication(token, applicationId, {
  //       responses: responseArray
  //     })
  //     const progressData = await getApplicationProgress(token, applicationId)
  //     setProgress(progressData)
  //   } catch (error) {
  //     console.error('Table data autosave failed:', error)
  //   } finally {
  //     setSaving(false)
  //   }
  // }

  const handleFileUpload = async (questionId: string, file: File) => {
    if (!token) return

    setUploadingFiles(prev => ({ ...prev, [questionId]: true }))
    try {
      const result = await uploadFile(token, file, applicationId, questionId)
      
      // Store file info
      setUploadedFiles(prev => ({
        ...prev,
        [questionId]: {
          id: result.file_id,
          filename: result.filename,
          size: file.size,
          content_type: file.type,
          url: result.url,
          created_at: new Date().toISOString()
        }
      }))

      // Update response to indicate file is uploaded
      setResponses(prev => ({
        ...prev,
        [questionId]: result.file_id
      }))

      // If this is a profile picture, update the profile picture URL
      const question = sections.flatMap(s => s.questions).find(q => q.id === questionId);
      if (question?.question_type === 'profile_picture') {
        setProfilePictureUrl(result.url);
      }

      // Refresh progress
      const progressData = await getApplicationProgress(token, applicationId)
      setProgress(progressData)
    } catch (error) {
      console.error('File upload failed:', error)
      toast.error('Failed to upload file. Please try again.')
    } finally {
      setUploadingFiles(prev => ({ ...prev, [questionId]: false }))
    }
  }

  const handleFileDelete = async (questionId: string) => {
    if (!token) return

    const fileInfo = uploadedFiles[questionId]
    if (!fileInfo) return

    try {
      await deleteFile(token, fileInfo.id)
      
      // Remove file from state
      setUploadedFiles(prev => {
        const newState = { ...prev }
        delete newState[questionId]
        return newState
      })

      // Clear response
      setResponses(prev => {
        const newState = { ...prev }
        delete newState[questionId]
        return newState
      })

      // If this was a profile picture, clear the profile picture URL
      const question = sections.flatMap(s => s.questions).find(q => q.id === questionId);
      if (question?.question_type === 'profile_picture') {
        setProfilePictureUrl('');
      }

      // Refresh progress
      const progressData = await getApplicationProgress(token, applicationId)
      setProgress(progressData)
    } catch (error) {
      console.error('File deletion failed:', error)
      toast.error('Failed to delete file. Please try again.')
    }
  }

  // Drag and drop handlers for file upload areas
  const handleDragOver = (e: React.DragEvent, questionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverQuestionId(questionId)
  }

  const handleDragEnter = (e: React.DragEvent, questionId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverQuestionId(questionId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverQuestionId(null)
  }

  const handleDrop = (e: React.DragEvent, questionId: string, acceptedTypes?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverQuestionId(null)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]

      // Validate file type if acceptedTypes is provided
      if (acceptedTypes) {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
        const acceptedList = acceptedTypes.split(',').map(t => t.trim().toLowerCase())
        const isValidType = acceptedList.some(type => {
          // Handle wildcard like "image/*"
          if (type.includes('/*')) {
            const category = type.split('/')[0]
            return file.type.startsWith(category + '/')
          }
          // Handle extension like ".pdf"
          if (type.startsWith('.')) {
            return fileExtension === type
          }
          // Handle mime type like "image/png"
          return file.type === type
        })

        if (!isValidType) {
          toast.error(`Invalid file type. Please upload: ${acceptedTypes}`)
          return
        }
      }

      handleFileUpload(questionId, file)
    }
  }

  // Helper function to get the actual value from a response (handles JSON structure)
  const getResponseValue = (questionId: string): string => {
    // Always use String() to ensure consistent key lookup (UUIDs may be objects or strings)
    const response = responses[String(questionId)]
    if (!response) return ''

    try {
      const parsed = JSON.parse(response)
      return parsed.value || ''
    } catch {
      return response
    }
  }

  // Helper function to get the detail value from a response
  const getResponseDetail = (questionId: string): string => {
    // Always use String() to ensure consistent key lookup (UUIDs may be objects or strings)
    const response = responses[String(questionId)]
    if (!response) return ''

    try {
      const parsed = JSON.parse(response)
      return parsed.detail || ''
    } catch {
      return ''
    }
  }

  // Format phone number as (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string): string => {
    // Strip all non-numeric characters
    const numbers = value.replace(/\D/g, '')

    // Limit to 10 digits
    const limited = numbers.slice(0, 10)

    // Format based on length
    if (limited.length === 0) return ''
    if (limited.length <= 3) return `(${limited}`
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`
  }

  const handleResponseChange = (questionId: string, value: string, isDetail: boolean = false) => {
    setResponses(prev => {
      // Create a new object to ensure React detects the change
      const newResponses = { ...prev }

      if (isDetail) {
        // For detail responses, store as JSON with both the main answer and detail
        const mainQuestionId = questionId.replace('_detail', '')

        // Get the actual value (not the JSON string)
        let currentValue = ''
        const existingResponse = newResponses[mainQuestionId]
        if (existingResponse) {
          try {
            const parsed = JSON.parse(existingResponse)
            currentValue = parsed.value || ''
          } catch {
            currentValue = existingResponse
          }
        }

        // Create a JSON structure that includes both the selection and the detail
        const responseObj = {
          value: currentValue,
          detail: value
        }

        if (value === '') {
          // If detail is empty, just store the main value
          newResponses[mainQuestionId] = currentValue
        } else {
          // Store as JSON string
          newResponses[mainQuestionId] = JSON.stringify(responseObj)
        }
      } else {
        // For regular responses
        if (value === '') {
          delete newResponses[questionId]
        } else {
          // Check if we need to preserve existing detail
          const existingResponse = prev[questionId]
          try {
            const parsed = existingResponse ? JSON.parse(existingResponse) : null
            if (parsed && parsed.detail) {
              // Preserve the detail when updating the main value
              newResponses[questionId] = JSON.stringify({ value, detail: parsed.detail })
            } else {
              newResponses[questionId] = value
            }
          } catch {
            // Not JSON, just a regular value
            newResponses[questionId] = value
          }
        }
      }

      // Mark as having unsaved changes immediately
      hasUnsavedChanges.current = true

      // CRITICAL: Update ref synchronously so Save & Exit always has latest data
      // React's setState is async, but we need the ref updated immediately
      responsesRef.current = newResponses

      return newResponses
    })

    // Update camper name in real-time if this is a name question
    if (!isDetail) {
      const question = sections.flatMap(s => s.questions).find(q => q.id === questionId);
      if (question) {
        const questionText = question.question_text.toLowerCase();

        if (questionText.includes('first name') && questionText.includes('camper')) {
          setCamperFirstName(value);
        }

        if (questionText.includes('last name') && questionText.includes('camper')) {
          setCamperLastName(value);
        }
      }
    }
  }

  // Check if a section has any required questions (used for progress display logic)
  const sectionHasRequiredQuestions = (sectionId: string) => {
    if (!progress) return false
    const sectionProgress = progress.section_progress.find(sp => sp.section_id === sectionId)
    return sectionProgress ? sectionProgress.required_questions > 0 : false
  }

  const getProgressIcon = (sectionId: string) => {
    if (!progress) return <Circle className="h-5 w-5 text-gray-300" />

    const sectionProgress = progress.section_progress.find(sp => sp.section_id === sectionId)
    if (!sectionProgress) return <Circle className="h-5 w-5 text-gray-300" />

    // If section has NO required questions, always show default (gray circle)
    // These sections don't track progress - they're all optional
    if (sectionProgress.required_questions === 0) {
      return <Circle className="h-5 w-5 text-gray-300" />
    }

    // Only show progress indicators for sections WITH required questions
    if (sectionProgress.is_complete) return <CheckCircle2 className="h-5 w-5 text-camp-green" />
    if (sectionProgress.answered_required > 0) return <Loader2 className="h-5 w-5 text-camp-orange" />
    return <Circle className="h-5 w-5 text-gray-300" />
  }

  const getProgressPercentage = (sectionId: string) => {
    if (!progress) return 0
    const sectionProgress = progress.section_progress.find(sp => sp.section_id === sectionId)
    if (!sectionProgress) return 0

    // If section has NO required questions, return 0 (no progress bar shown)
    if (sectionProgress.required_questions === 0) return 0

    return sectionProgress.completion_percentage || 0
  }

  // Check if a question should be shown based on conditional logic
  const shouldShowQuestion = (question: any): boolean => {
    // If no conditional logic, always show
    if (!question.show_if_question_id || !question.show_if_answer) {
      return true;
    }

    // Get the response to the trigger question
    const triggerResponse = responses[question.show_if_question_id];

    // Debug logging for troubleshooting
    console.log('shouldShowQuestion check:', {
      questionText: question.question_text,
      showIfQuestionId: question.show_if_question_id,
      showIfAnswer: question.show_if_answer,
      triggerResponse,
      willShow: triggerResponse && triggerResponse !== '' && triggerResponse === question.show_if_answer
    });

    // Only show if trigger response exists AND matches expected answer
    // This prevents conditional questions from showing before the trigger is answered
    if (!triggerResponse || triggerResponse === '') {
      return false;
    }

    // Show if the trigger question has the expected answer
    return triggerResponse === question.show_if_answer;
  }

  // Helper type for unified section items (headers + questions)
  type SectionItem =
    | { type: 'header'; data: SectionHeader; order_index: number }
    | { type: 'question'; data: ApplicationQuestion; order_index: number }

  // Get unified items (headers + questions) sorted by order_index
  // This allows headers to be rendered as dividers between question groups
  const getSectionItems = (section: ApplicationSection): SectionItem[] => {
    const activeHeaders = (section.headers || []).filter(h => h.is_active)
    const items: SectionItem[] = [
      ...activeHeaders.map(h => ({ type: 'header' as const, data: h, order_index: h.order_index })),
      ...section.questions.map(q => ({ type: 'question' as const, data: q, order_index: q.order_index }))
    ]
    return items.sort((a, b) => a.order_index - b.order_index)
  }

  // Compute missing required questions for the current section
  // This enables the "Find Missing" feature without being intrusive
  useEffect(() => {
    if (!sections.length || currentSectionIndex >= sections.length) {
      setSectionMissingQuestions([])
      return
    }

    const currentSection = sections[currentSectionIndex]
    if (!currentSection) return

    const missing: Array<{ questionId: string; questionText: string; questionNumber: number }> = []
    let questionNumber = 0

    // Get items in order and check visibility
    const items = getSectionItems(currentSection)

    items.forEach((item) => {
      if (item.type !== 'question') return

      const question = item.data as ApplicationQuestion

      // Only count visible questions
      if (!shouldShowQuestion(question)) return

      questionNumber++

      // Check if required and unanswered
      if (question.is_required) {
        const response = responses[question.id]
        const hasAnswer = response && response.trim() !== ''

        if (!hasAnswer) {
          missing.push({
            questionId: question.id,
            questionText: question.question_text,
            questionNumber
          })
        }
      }
    })

    setSectionMissingQuestions(missing)
    // Reset the navigation index when section changes
    setCurrentMissingIndex(-1)
    setHighlightedQuestionId(null)
  }, [sections, currentSectionIndex, responses])

  // Navigate to the next missing question with smooth scroll and highlight
  const goToNextMissing = () => {
    if (sectionMissingQuestions.length === 0) return

    // Calculate next index (cycle through)
    const nextIndex = currentMissingIndex < sectionMissingQuestions.length - 1
      ? currentMissingIndex + 1
      : 0

    setCurrentMissingIndex(nextIndex)
    const questionId = sectionMissingQuestions[nextIndex].questionId

    // Scroll to the question
    const element = questionRefs.current[questionId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Apply highlight animation
      setHighlightedQuestionId(questionId)

      // Remove highlight after animation completes
      setTimeout(() => {
        setHighlightedQuestionId(null)
      }, 2500)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-white to-emerald-50/30">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 bg-camp-green/10 rounded-full flex items-center justify-center mb-4 mx-auto">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-camp-green/20 border-t-camp-green"></div>
            </div>
          </div>
          <p className="text-camp-charcoal font-medium">Loading your application...</p>
          <p className="text-gray-500 text-sm mt-1">This won't take long</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/50 via-white to-emerald-50/30 px-4">
        <Card className="max-w-md w-full shadow-xl border-0 ring-1 ring-red-200">
          <CardHeader className="bg-red-50 border-b border-red-100">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-700 mb-6">{error}</p>
            <div className="flex gap-3">
              <Button onClick={() => window.location.reload()} className="flex-1 bg-camp-green hover:bg-camp-green/90">
                Try Again
              </Button>
              <Button onClick={() => router.push('/dashboard')} variant="outline" className="flex-1">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentSection = sections[currentSectionIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/50 via-white to-emerald-50/30 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Section Navigation */}
      <aside className={`
        fixed lg:sticky inset-y-0 lg:top-0 left-0 z-50
        w-80 lg:h-screen bg-white border-r border-gray-200 flex flex-col shadow-xl
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header with Camp Theme */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-camp-green via-camp-green to-emerald-600 relative overflow-hidden">
          {/* Decorative nature elements */}
          <div className="absolute top-0 right-0 opacity-10">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L8 6H4l8 8 8-8h-4L12 2zM4 10l8 8 8-8H4z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-1 relative z-10">🏕️ Application Progress</h2>
          <p className="text-white/90 text-sm relative z-10">
            {progress?.completed_sections || 0} of {progress?.total_sections || 0} sections complete
          </p>
          <div className="mt-3 bg-white/20 rounded-full h-3 overflow-hidden relative z-10">
            <div
              className="bg-gradient-to-r from-amber-300 to-amber-400 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress?.overall_percentage || 0}%` }}
            />
          </div>
          <p className="text-white/90 text-sm mt-2 font-medium relative z-10">
            {progress?.overall_percentage || 0}% Complete
          </p>
        </div>

        {/* Sections List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sections.map((section, index) => {
            const progressIcon = getProgressIcon(section.id)
            const percentage = getProgressPercentage(section.id)
            const isActive = index === currentSectionIndex
            const hasRequired = sectionHasRequiredQuestions(section.id)
            // Only show "complete" styling for sections that have required questions AND are 100%
            const isComplete = hasRequired && percentage === 100

            return (
              <button
                key={section.id}
                onClick={() => setCurrentSectionIndex(index)}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 border-2 ${
                  isActive
                    ? 'bg-gradient-to-r from-camp-green to-emerald-600 text-white shadow-lg border-transparent scale-[1.02]'
                    : isComplete
                      ? 'bg-green-50 hover:bg-green-100 text-camp-charcoal border-green-200 hover:border-green-300'
                      : 'bg-white hover:bg-gray-50 text-camp-charcoal border-gray-200 hover:border-camp-green/50 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 pr-2">
                    <p className="font-semibold text-sm line-clamp-2">
                      {index + 1}. {section.title}
                    </p>
                  </div>
                  <span className="flex-shrink-0">{progressIcon}</span>
                </div>

                {/* Progress bar - only show if section has required questions */}
                {!isActive && hasRequired && (
                  <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-camp-orange'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
                {isActive && hasRequired && (
                  <div className="bg-white/20 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-white h-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Autosave Indicator - Enhanced for visibility */}
        <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
            saving
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-green-100 text-green-800 border border-green-200'
          }`}>
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>Saving changes...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>All changes auto-saved</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Your work saves automatically as you type
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 lg:px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl bg-camp-green/10 hover:bg-camp-green/20 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-camp-orange bg-camp-orange/10 px-2 py-0.5 rounded-full">
                  Section {currentSectionIndex + 1}/{sections.length}
                </span>
              </div>
              <h1 className="text-xl lg:text-2xl font-bold text-camp-charcoal mt-1">
                {currentSection?.title}
              </h1>
              {currentSection?.description && (
                <p className="text-gray-600 text-sm mt-1 hidden sm:block">
                  {currentSection.description}
                </p>
              )}
            </div>
          </div>
          {/* Autosave Status - Prominent indicator users can't miss */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
            saving
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline">Auto-saved</span>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              // Save any pending changes before exiting
              if (hasUnsavedChanges.current) {
                setSaving(true)
                await saveResponses()
                hasUnsavedChanges.current = false
              }
              router.push('/dashboard')
            }}
            className="ml-2"
            disabled={saving}
          >
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save & Exit'}</span>
            <span className="sm:hidden">{saving ? 'Saving...' : 'Exit'}</span>
          </Button>
        </header>

        {/* Section Indicator Bar - Sticky below header, always visible while scrolling */}
        <div className="bg-camp-green/95 backdrop-blur-sm text-white px-4 py-2 shadow-md sticky top-[73px] z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">
                Section {currentSectionIndex + 1}/{sections.length}
              </span>
              <span className="text-sm font-semibold hidden sm:inline">{currentSection?.title}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {/* Find Missing Questions - Chip button */}
              {sectionMissingQuestions.length > 0 &&
               currentSection?.questions.some(q => responses[q.id] && responses[q.id].trim() !== '') && (
                <button
                  onClick={goToNextMissing}
                  className="group flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-amber-900 px-2.5 py-0.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>
                    {currentMissingIndex === -1
                      ? `${sectionMissingQuestions.length} missing`
                      : `${currentMissingIndex + 1}/${sectionMissingQuestions.length}`}
                  </span>
                  <svg className="w-2.5 h-2.5 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              )}
              {getProgressPercentage(currentSection?.id) === 100 ? (
                <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Complete
                </span>
              ) : (
                <span className="bg-white/20 px-2 py-0.5 rounded-full">
                  {getProgressPercentage(currentSection?.id)}% done
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Questions - Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto">
            <Card className="shadow-lg border-0 ring-1 ring-gray-200/50 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg sm:text-xl text-camp-charcoal flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-camp-green/10 flex items-center justify-center text-camp-green text-sm font-bold">
                      {currentSectionIndex + 1}
                    </span>
                    {currentSection?.title}
                  </CardTitle>
                  {/* Only show Complete badge for sections WITH required questions */}
                  {sectionHasRequiredQuestions(currentSection?.id) && getProgressPercentage(currentSection?.id) === 100 && (
                    <span className="flex items-center gap-1 text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-4 h-4" />
                      Complete
                    </span>
                  )}
                </div>
                <CardDescription className="text-sm flex items-center gap-2">
                  {sectionHasRequiredQuestions(currentSection?.id) ? (
                    <>
                      <span className="text-camp-orange">●</span>
                      Complete all required questions to proceed
                    </>
                  ) : (
                    <>
                      <span className="text-gray-400">○</span>
                      All questions in this section are optional
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 sm:space-y-8">
                {/* Profile Header - Shows camper name and photo */}
                <ProfileHeader
                  firstName={camperFirstName}
                  lastName={camperLastName}
                  profilePictureUrl={profilePictureUrl}
                  sex={camperSex}
                  dateOfBirth={camperDateOfBirth}
                />

                {/* Render unified items (headers + questions) sorted by order_index */}
                {currentSection && (() => {
                  const items = getSectionItems(currentSection)
                  let questionNumber = 0 // Track question numbering separately

                  return items.map((item) => {
                    // Render section headers as sub-section dividers
                    if (item.type === 'header') {
                      const header = item.data as SectionHeader
                      return (
                        <div key={`header-${header.id}`} className="pt-6 pb-4 first:pt-0">
                          <div className="pb-3 border-b-2 border-camp-green/30">
                            <h3 className="text-xl sm:text-2xl font-bold text-camp-charcoal">
                              {header.header_text}
                            </h3>
                          </div>
                        </div>
                      )
                    }

                    // Render questions
                    const question = item.data as ApplicationQuestion

                    // Check conditional visibility
                    if (!shouldShowQuestion(question)) {
                      return null
                    }

                    questionNumber++ // Increment for visible questions only
                    const qIndex = questionNumber - 1 // 0-based index for display

                    // Check if this question is currently highlighted by the Find Missing feature
                    const isHighlighted = highlightedQuestionId === question.id

                    return (
                  <div
                    key={question.id}
                    ref={(el) => { questionRefs.current[question.id] = el }}
                    className={`pb-6 sm:pb-8 border-b border-gray-200 last:border-0 transition-all duration-500 rounded-lg ${
                      isHighlighted
                        ? 'bg-gradient-to-r from-amber-50 via-amber-50/80 to-transparent ring-2 ring-amber-300 ring-offset-2 p-4 -mx-4 animate-pulse'
                        : ''
                    }`}
                  >
                    {/* Legacy: Section Header from question field (deprecated) */}
                    {question.header_text && (
                      <div className="mb-6 pb-3 border-b-2 border-camp-green/30">
                        <h3 className="text-xl sm:text-2xl font-bold text-camp-charcoal">
                          {question.header_text}
                        </h3>
                      </div>
                    )}

                    <label className="block text-sm sm:text-base font-medium text-camp-charcoal mb-3">
                      {questionNumber}. {question.question_text}
                      {question.is_required && (
                        <span className="text-camp-orange ml-1">*</span>
                      )}
                    </label>

                    {question.help_text && (
                      <p className="text-sm text-gray-600 mb-4">
                        {question.help_text}
                      </p>
                    )}

                    {question.description && (
                      <div className="prose prose-sm max-w-none mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSanitize]}
                        >
                          {question.description}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Render different input types */}
                    {question.question_type === 'text' && (
                      <input
                        type="text"
                        placeholder={question.placeholder || ''}
                        value={responses[question.id] || ''}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        className="w-full min-h-[48px] px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                        required={question.is_required}
                      />
                    )}

                    {question.question_type === 'textarea' && (
                      <textarea
                        placeholder={question.placeholder || ''}
                        value={responses[question.id] || ''}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors resize-y"
                        required={question.is_required}
                      />
                    )}

                    {question.question_type === 'dropdown' && question.options && (
                      <>
                        <select
                          value={getResponseValue(question.id)}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          className="w-full min-h-[48px] px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                          required={question.is_required}
                        >
                          <option value="">Select an option...</option>
                          {Array.isArray(question.options) && question.options.map((option: string, i: number) => (
                            <option key={i} value={option}>{option}</option>
                          ))}
                        </select>

                        {/* Detail Prompt - Show textarea when specific answer is selected */}
                        {question.detail_prompt_trigger &&
                         question.detail_prompt_text &&
                         Array.isArray(question.detail_prompt_trigger) &&
                         question.detail_prompt_trigger.includes(getResponseValue(question.id)) && (
                          <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                            <label className="block text-sm font-medium text-blue-900 mb-2">
                              {question.detail_prompt_text}
                            </label>
                            <textarea
                              value={getResponseDetail(question.id)}
                              onChange={(e) => handleResponseChange(`${question.id}_detail`, e.target.value, true)}
                              rows={4}
                              className="w-full px-4 py-3 text-base border-2 border-blue-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors resize-y"
                              placeholder="Please provide details..."
                            />
                          </div>
                        )}
                      </>
                    )}

                    {question.question_type === 'email' && (
                      <input
                        type="email"
                        placeholder={question.placeholder || 'your.email@example.com'}
                        value={responses[question.id] || ''}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        className="w-full min-h-[48px] px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                        required={question.is_required}
                      />
                    )}

                    {question.question_type === 'phone' && (
                      <input
                        type="tel"
                        placeholder={question.placeholder || '(555) 123-4567'}
                        value={responses[question.id] || ''}
                        onChange={(e) => handleResponseChange(question.id, formatPhoneNumber(e.target.value))}
                        className="w-full min-h-[48px] px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                        required={question.is_required}
                      />
                    )}

                    {question.question_type === 'date' && (
                      <input
                        type="date"
                        value={responses[question.id] || ''}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        className="w-full min-h-[48px] px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                        required={question.is_required}
                      />
                    )}

                    {question.question_type === 'multiple_choice' && question.options && (
                      <>
                        <div className="space-y-3">
                          {Array.isArray(question.options) && question.options.map((option: string, i: number) => (
                            <label key={i} className="flex items-center space-x-3 cursor-pointer p-3 border-2 border-gray-300 rounded-lg hover:border-camp-green hover:bg-camp-green/5 transition-colors">
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value={option}
                                checked={getResponseValue(question.id) === option}
                                onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                className="w-5 h-5 text-camp-green focus:ring-camp-green border-gray-300"
                                required={question.is_required}
                              />
                              <span className="text-sm sm:text-base text-gray-700 flex-1">{option}</span>
                            </label>
                          ))}
                        </div>

                        {/* Detail Prompt - Show textarea when specific answer is selected */}
                        {question.detail_prompt_trigger &&
                         question.detail_prompt_text &&
                         Array.isArray(question.detail_prompt_trigger) &&
                         question.detail_prompt_trigger.includes(getResponseValue(question.id)) && (
                          <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                            <label className="block text-sm font-medium text-blue-900 mb-2">
                              {question.detail_prompt_text}
                            </label>
                            <textarea
                              value={getResponseDetail(question.id)}
                              onChange={(e) => handleResponseChange(`${question.id}_detail`, e.target.value, true)}
                              rows={4}
                              className="w-full px-4 py-3 text-base border-2 border-blue-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors resize-y"
                              placeholder="Please provide details..."
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Checkbox with options - Multi-select checkboxes */}
                    {question.question_type === 'checkbox' && question.options && Array.isArray(question.options) && question.options.length > 0 && (
                      <>
                        <div className="space-y-2">
                          {question.options.map((option: string, i: number) => {
                            const selectedOptions = responses[question.id] ? responses[question.id].split(',') : [];
                            const isChecked = selectedOptions.includes(option);

                            return (
                              <label key={i} className="flex items-start space-x-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentSelected = responses[question.id] ? responses[question.id].split(',').filter(v => v) : [];
                                    let newSelected;
                                    if (e.target.checked) {
                                      newSelected = [...currentSelected, option];
                                    } else {
                                      newSelected = currentSelected.filter(v => v !== option);
                                    }
                                    handleResponseChange(question.id, newSelected.join(','));
                                  }}
                                  className="mt-1 w-5 h-5 rounded border-gray-300 text-camp-green focus:ring-camp-green flex-shrink-0"
                                />
                                <span className="text-sm sm:text-base text-gray-700 flex-1">{option}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Detail Prompt - Show textarea when specific options are selected */}
                        {question.detail_prompt_trigger &&
                         question.detail_prompt_text &&
                         Array.isArray(question.detail_prompt_trigger) &&
                         question.detail_prompt_trigger.some((trigger: string) =>
                           responses[question.id]?.split(',').includes(trigger)
                         ) && (
                          <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                            <label className="block text-sm font-medium text-blue-900 mb-2">
                              {question.detail_prompt_text}
                            </label>
                            <textarea
                              value={responses[`${question.id}_detail`] || ''}
                              onChange={(e) => handleResponseChange(`${question.id}_detail`, e.target.value)}
                              rows={4}
                              className="w-full px-4 py-3 text-base border-2 border-blue-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors resize-y"
                              placeholder="Please provide details..."
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Checkbox without options - Single agreement checkbox (authorization style) */}
                    {question.question_type === 'checkbox' && (!question.options || !Array.isArray(question.options) || question.options.length === 0) && (
                      <label className="flex items-center space-x-3 cursor-pointer p-4 bg-camp-green/5 border-2 border-camp-green/30 rounded-lg hover:border-camp-green hover:bg-camp-green/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={responses[question.id] === 'true'}
                          onChange={(e) => handleResponseChange(question.id, e.target.checked ? 'true' : '')}
                          className="w-6 h-6 rounded border-gray-300 text-camp-green focus:ring-camp-green flex-shrink-0"
                          required={question.is_required}
                        />
                        <span className="text-sm sm:text-base text-camp-green font-medium">
                          {responses[question.id] === 'true' ? '✓ Agreed' : 'Check to agree'}
                        </span>
                      </label>
                    )}

                    {question.question_type === 'signature' && (
                      <label className="flex items-start space-x-3 cursor-pointer bg-camp-green/5 border border-camp-green/40 rounded-lg p-4 sm:p-5">
                        <input
                          type="checkbox"
                          checked={responses[question.id] === 'true'}
                          onChange={(e) => handleResponseChange(question.id, e.target.checked.toString())}
                          className="mt-1 w-6 h-6 flex-shrink-0 rounded border-gray-300 text-camp-green focus:ring-camp-green"
                          required={question.is_required}
                        />
                        <span className="text-sm sm:text-base text-gray-700 leading-relaxed">
                          By checking this box, I acknowledge that this acts as my Parent/Guardian signature for this application and that all information provided is accurate to the best of my knowledge.
                        </span>
                      </label>
                    )}

                    {question.question_type === 'file_upload' && (
                      <div className="space-y-4">
                        {/* Template file download button */}
                        {question.template_file_id && (
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-blue-900">
                                  Download Template
                                </p>
                                <p className="text-xs text-blue-700">
                                  Download, complete, and upload the form using the button below
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!token) return
                                  try {
                                    const templateFile = await getTemplateFile(token, question.template_file_id!)
                                    window.open(templateFile.url, '_blank')
                                  } catch (error) {
                                    console.error('Failed to download template:', error)
                                    toast.error('Failed to download template file')
                                  }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        )}

                        {uploadedFiles[question.id] ? (
                          // Show uploaded file
                          <div className="border-2 border-camp-green rounded-lg p-4 bg-green-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <svg className="h-8 w-8 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <div>
                                  <p className="text-sm font-medium text-camp-charcoal">
                                    {uploadedFiles[question.id].filename}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {(uploadedFiles[question.id].size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <a
                                  href={uploadedFiles[question.id].url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-camp-green hover:underline"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => handleFileDelete(question.id)}
                                  className="text-sm text-red-600 hover:underline"
                                  type="button"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Show upload area with drag & drop support
                          <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                              dragOverQuestionId === question.id
                                ? 'border-camp-green bg-camp-green/10'
                                : 'border-gray-300 hover:border-camp-green'
                            }`}
                            onDragOver={(e) => handleDragOver(e, question.id)}
                            onDragEnter={(e) => handleDragEnter(e, question.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, question.id, '.pdf,.doc,.docx,.jpg,.jpeg,.png')}
                          >
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              className="hidden"
                              id={`file-${question.id}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  handleFileUpload(question.id, file)
                                }
                              }}
                              required={question.is_required && !uploadedFiles[question.id]}
                            />
                            <label
                              htmlFor={`file-${question.id}`}
                              className={`cursor-pointer ${uploadingFiles[question.id] ? 'opacity-50' : ''}`}
                            >
                              <div className="text-gray-600">
                                {uploadingFiles[question.id] ? (
                                  <>
                                    <svg className="animate-spin mx-auto h-12 w-12 text-camp-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                    <p className="mt-2 text-sm text-camp-green">Uploading...</p>
                                  </>
                                ) : dragOverQuestionId === question.id ? (
                                  <>
                                    <svg className="mx-auto h-12 w-12 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <p className="mt-2 text-sm font-medium text-camp-green">
                                      Drop file here
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <p className="mt-2 text-sm">
                                      <span className="font-medium text-camp-green">Click to upload</span>
                                      {' '}or drag and drop
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      PDF, DOC, DOCX, JPG, PNG (max 10MB)
                                    </p>
                                  </>
                                )}
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Medication List */}
                    {question.question_type === 'medication_list' && (
                      <MedicationList
                        questionId={question.id}
                        applicationId={applicationId}
                        value={medications[question.id] || []}
                        onChange={(meds) => {
                          setMedications(prev => ({ ...prev, [question.id]: meds }))
                          // Also update responses to trigger autosave
                          handleResponseChange(question.id, JSON.stringify(meds))
                        }}
                        medicationFields={(question.options as any)?.medication_fields}
                        doseFields={(question.options as any)?.dose_fields}
                        isRequired={question.is_required}
                      />
                    )}

                    {/* Allergy List */}
                    {question.question_type === 'allergy_list' && (
                      <AllergyList
                        questionId={question.id}
                        applicationId={applicationId}
                        value={allergies[question.id] || []}
                        onChange={(allergyList) => {
                          setAllergies(prev => ({ ...prev, [question.id]: allergyList }))
                          // Also update responses to trigger autosave
                          handleResponseChange(question.id, JSON.stringify(allergyList))
                        }}
                        allergyFields={(question.options as any)?.allergy_fields}
                        isRequired={question.is_required}
                      />
                    )}

                    {/* Generic Table */}
                    {question.question_type === 'table' && (
                      <GenericTable
                        questionId={question.id}
                        applicationId={applicationId}
                        value={tableData[question.id] || []}
                        onChange={(rows) => {
                          setTableData(prev => ({ ...prev, [question.id]: rows }))
                          // Also update responses to trigger autosave
                          handleResponseChange(question.id, JSON.stringify(rows))
                        }}
                        columns={(question.options as any)?.columns || []}
                        addButtonText={(question.options as any)?.addButtonText}
                        emptyStateText={(question.options as any)?.emptyStateText}
                        isRequired={question.is_required}
                      />
                    )}

                    {/* Profile Picture Upload - Image-focused */}
                    {question.question_type === 'profile_picture' && (
                      <div className="space-y-4">
                        {uploadedFiles[question.id] ? (
                          // Show uploaded profile picture with preview
                          <div className="border-2 border-camp-green rounded-lg p-6 bg-green-50">
                            <div className="flex flex-col items-center gap-4">
                              <img
                                src={uploadedFiles[question.id].url}
                                alt="Camper Profile Picture"
                                className="h-32 w-32 rounded-full object-cover border-4 border-camp-green shadow-lg"
                              />
                              <div className="text-center">
                                <p className="text-sm font-medium text-camp-charcoal">
                                  {uploadedFiles[question.id].filename}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(uploadedFiles[question.id].size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <a
                                  href={uploadedFiles[question.id].url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-camp-green hover:underline"
                                >
                                  View Full Size
                                </a>
                                <span className="text-gray-300">|</span>
                                <button
                                  onClick={() => handleFileDelete(question.id)}
                                  className="text-sm text-red-600 hover:underline"
                                  type="button"
                                >
                                  Change Photo
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Show upload area with drag & drop support
                          <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                              dragOverQuestionId === question.id
                                ? 'border-camp-green bg-camp-green/10'
                                : 'border-gray-300 hover:border-camp-green'
                            }`}
                            onDragOver={(e) => handleDragOver(e, question.id)}
                            onDragEnter={(e) => handleDragEnter(e, question.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, question.id, 'image/*,.jpg,.jpeg,.png,.gif')}
                          >
                            <input
                              type="file"
                              accept="image/*,.jpg,.jpeg,.png,.gif"
                              className="hidden"
                              id={`profile-pic-${question.id}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  handleFileUpload(question.id, file)
                                }
                              }}
                              required={question.is_required && !uploadedFiles[question.id]}
                            />
                            <label
                              htmlFor={`profile-pic-${question.id}`}
                              className={`cursor-pointer ${uploadingFiles[question.id] ? 'opacity-50' : ''}`}
                            >
                              <div className="text-gray-600">
                                {uploadingFiles[question.id] ? (
                                  <>
                                    <svg className="animate-spin mx-auto h-16 w-16 text-camp-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                    <p className="mt-3 text-sm text-camp-green font-medium">Uploading Photo...</p>
                                  </>
                                ) : dragOverQuestionId === question.id ? (
                                  <>
                                    <div className="mx-auto h-20 w-20 rounded-full bg-camp-green/20 flex items-center justify-center mb-4">
                                      <svg className="h-10 w-10 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                      </svg>
                                    </div>
                                    <p className="mt-2 text-base font-medium text-camp-green">
                                      Drop photo here
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <div className="mx-auto h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                                      <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                    <p className="mt-2 text-base font-medium">
                                      <span className="text-camp-green">Click to upload photo</span>
                                      {' '}or drag and drop
                                    </p>
                                    <p className="text-sm text-gray-500 mt-2">
                                      JPG, PNG, or GIF (max 5MB)
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      This photo will appear at the top of your application
                                    </p>
                                  </>
                                )}
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                    )
                  })
                })()}
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mt-8 sm:mt-10 pb-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentSectionIndex(Math.max(0, currentSectionIndex - 1))}
                disabled={currentSectionIndex === 0}
                className="w-full sm:w-auto min-h-[52px] text-base font-medium border-2 hover:border-camp-green hover:bg-camp-green/5 disabled:opacity-40"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Previous Section</span>
                <span className="sm:hidden">Previous</span>
              </Button>

              {currentSectionIndex < sections.length - 1 ? (
                <Button
                  size="lg"
                  onClick={() => setCurrentSectionIndex(currentSectionIndex + 1)}
                  className="w-full sm:w-auto min-h-[52px] text-base font-medium bg-gradient-to-r from-camp-green to-emerald-600 hover:from-camp-green/90 hover:to-emerald-700 shadow-lg shadow-camp-green/25 hover:shadow-xl hover:shadow-camp-green/30 transition-all"
                >
                  <span className="hidden sm:inline">Next Section</span>
                  <span className="sm:hidden">Next</span>
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              ) : (
                <div className="text-center flex-1">
                  {progress?.overall_percentage === 100 ? (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-800">🎉 Application Complete!</p>
                          <p className="text-green-700 text-sm mt-1">
                            Your application will be reviewed by our team. We'll be in touch soon!
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                      <p className="text-amber-800 text-sm font-medium flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Complete all required questions to finish your application
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}
