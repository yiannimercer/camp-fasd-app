'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useToast } from '@/components/shared/ToastNotification';
import { ConfirmationModal } from '@/components/shared/ConfirmationModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FieldConfigurator, { FieldConfig } from '@/components/FieldConfigurator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Copy,
  MoveUp,
  MoveDown,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  GitBranch
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  duplicateQuestion,
  reorderQuestions,
  createHeader,
  updateHeader,
  deleteHeader,
  reorderHeaders,
  Section,
  Question,
  Header,
  SectionCreate,
  SectionUpdate,
  QuestionCreate,
  QuestionUpdate,
  HeaderCreate,
  HeaderUpdate,
} from '@/lib/api-application-builder';
import { uploadTemplateFile, getTemplateFile } from '@/lib/api-files';

const questionTypes = [
  { value: 'text', label: 'Short Text', description: 'Single line text input' },
  { value: 'textarea', label: 'Long Text', description: 'Multi-line text area' },
  { value: 'dropdown', label: 'Dropdown', description: 'Select one from dropdown' },
  { value: 'multiple_choice', label: 'Multiple Choice', description: 'Select one option' },
  { value: 'checkbox', label: 'Checkboxes', description: 'Select multiple options' },
  { value: 'file_upload', label: 'File Upload', description: 'Upload documents' },
  { value: 'profile_picture', label: 'Profile Picture', description: 'Upload camper photo (displays at top of each section)' },
  { value: 'medication_list', label: 'Medication List', description: 'Nested table for medications with dose schedules' },
  { value: 'allergy_list', label: 'Allergy List', description: 'List of allergies with severity and reactions' },
  { value: 'table', label: 'Generic Table', description: 'Customizable table with configurable columns' },
  { value: 'date', label: 'Date', description: 'Date picker' },
  { value: 'email', label: 'Email', description: 'Email address' },
  { value: 'phone', label: 'Phone', description: 'Phone number' },
  { value: 'signature', label: 'Signature', description: 'Electronic signature' },
];

const visibilityOptions = [
  { value: 'always', label: 'Always Visible', description: 'Show for all applicants' },
  { value: 'accepted', label: 'After Acceptance', description: 'Show only after camper is accepted' },
  { value: 'paid', label: 'After Payment', description: 'Show only after payment is complete' },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses', description: 'Show for both Applicants and Campers' },
  { value: 'applicant', label: 'Applicants Only', description: 'Show only while filling out the initial application' },
  { value: 'camper', label: 'Campers Only', description: 'Show only after being accepted as a camper' },
];

// Default field configurations for medication and allergy lists
const DEFAULT_MEDICATION_FIELDS: FieldConfig[] = [
  { name: 'medication_name', label: 'Medication', type: 'text', required: true, placeholder: 'e.g., Adderall' },
  { name: 'strength', label: 'Strength', type: 'text', required: true, placeholder: 'e.g., 15mg' },
  { name: 'dose_amount', label: 'Dose Amount', type: 'text', required: true, placeholder: 'e.g., 1 pill two times a day' },
  {
    name: 'dose_form',
    label: 'Dose Form',
    type: 'dropdown',
    required: true,
    options: ['Pill', 'Tablet', 'Capsule', 'Liquid', 'Eye Drop', 'Nasal Spray', 'Inhaler', 'Injection', 'Topical', 'Patch', 'Suppository']
  }
];

const DEFAULT_DOSE_FIELDS: FieldConfig[] = [
  {
    name: 'given_type',
    label: 'Given',
    type: 'dropdown',
    required: true,
    options: ['At specific time', 'As needed']
  },
  { name: 'time', label: 'Time', type: 'text', required: false, placeholder: 'HH:MM (e.g., 08:00, 14:30) or N/A' },
  { name: 'notes', label: 'Notes', type: 'textarea', required: false, placeholder: 'Additional instructions...' }
];

const DEFAULT_ALLERGY_FIELDS: FieldConfig[] = [
  { name: 'allergen', label: 'Allergen', type: 'text', required: true, placeholder: 'e.g., Peanuts, Penicillin' },
  { name: 'reaction', label: 'Reaction', type: 'text', required: true, placeholder: 'e.g., Hives, difficulty breathing' },
  {
    name: 'severity',
    label: 'Severity',
    type: 'dropdown',
    required: true,
    options: ['Mild', 'Moderate', 'Severe']
  },
  { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false, placeholder: 'Any additional information...' }
];

export default function ApplicationBuilderPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isHeaderDialogOpen, setIsHeaderDialogOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [draggedItem, setDraggedItem] = useState<{ sectionId: string; itemIndex: number; itemType: 'question' | 'header' } | null>(null);

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    type: 'section' | 'question' | 'header' | null;
    sectionId?: string;
    questionId?: string;
    headerId?: string;
    sectionTitle?: string;
    questionTitle?: string;
    headerTitle?: string;
  }>({ type: null });

  // Section form state
  const [sectionForm, setSectionForm] = useState({
    title: '',
    description: '',
    show_when_status: 'always' as 'always' | 'accepted' | 'paid',
    required_status: 'all' as 'all' | 'applicant' | 'camper',
    is_active: true,
  });

  // Question form state
  const [questionForm, setQuestionForm] = useState<Partial<Question>>({
    question_text: '',
    question_type: 'text' as Question['question_type'],
    help_text: '',
    is_required: true,
    is_active: true,
    persist_annually: false,
    show_when_status: null,
    options: [],
    validation_rules: {},
    show_if_question_id: null,
    show_if_answer: null,
  });

  // Header form state
  const [headerForm, setHeaderForm] = useState({
    header_text: '',
    is_active: true,
  });

  // Load sections on mount
  useEffect(() => {
    if (!token) return;

    const loadSections = async () => {
      try {
        setLoading(true);
        const data = await getSections(token, true); // Include inactive
        setSections(data);
      } catch (error) {
        console.error('Failed to load sections:', error);
        setSaveStatus('error');
      } finally {
        setLoading(false);
      }
    };

    loadSections();
  }, [token]);

  const handleCreateSection = () => {
    setSectionForm({
      title: '',
      description: '',
      show_when_status: 'always',
      required_status: 'all',
      is_active: true,
    });
    setEditingSectionId(null);
    setIsSectionDialogOpen(true);
  };

  const handleEditSection = (section: Section) => {
    setSectionForm({
      title: section.title,
      description: section.description || '',
      show_when_status: (section.show_when_status || 'always') as 'always' | 'accepted' | 'paid',
      required_status: (section.required_status || 'all') as 'all' | 'applicant' | 'camper',
      is_active: section.is_active,
    });
    setEditingSectionId(section.id);
    setIsSectionDialogOpen(true);
  };

  const handleSaveSection = async () => {
    if (!token) return;

    try {
      setSaving(true);

      if (editingSectionId) {
        // Update existing section
        const updated = await updateSection(token, editingSectionId, {
          title: sectionForm.title,
          description: sectionForm.description,
          is_active: sectionForm.is_active,
          show_when_status: sectionForm.show_when_status === 'always' ? null : sectionForm.show_when_status,
          required_status: sectionForm.required_status === 'all' ? null : sectionForm.required_status,
        });
        setSections(prev => prev.map(s => s.id === editingSectionId ? updated : s));
      } else {
        // Create new section
        const created = await createSection(token, {
          title: sectionForm.title,
          description: sectionForm.description,
          order_index: sections.length,
          is_active: sectionForm.is_active,
          show_when_status: sectionForm.show_when_status === 'always' ? null : sectionForm.show_when_status,
          required_status: sectionForm.required_status === 'all' ? null : sectionForm.required_status,
        });
        setSections(prev => [...prev, created]);
      }

      setSaveStatus('success');
      setIsSectionDialogOpen(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save section:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const showDeleteSectionModal = (sectionId: string, sectionTitle: string) => {
    setDeleteModal({ type: 'section', sectionId, sectionTitle });
  };

  const handleDeleteSection = async () => {
    if (!token || !deleteModal.sectionId) return;

    try {
      await deleteSection(token, deleteModal.sectionId);
      setSections(prev => prev.filter(s => s.id !== deleteModal.sectionId));
      toast.success('Section deleted successfully');
      setDeleteModal({ type: null });
    } catch (error) {
      console.error('Failed to delete section:', error);
      toast.error('Failed to delete section');
    }
  };

  const handleCreateQuestion = (sectionId: string) => {
    setQuestionForm({
      question_text: '',
      question_type: 'text',
      help_text: '',
      is_required: true,
      is_active: true,
      persist_annually: false,
      show_when_status: 'always',
      options: [],
      validation_rules: {},
      show_if_question_id: null,
      show_if_answer: null,
      detail_prompt_trigger: [],
      detail_prompt_text: null,
    });
    setSelectedSection(sections.find(s => s.id === sectionId) || null);
    setEditingQuestionId(null);
    setIsQuestionDialogOpen(true);
  };

  const handleEditQuestion = (sectionId: string, question: Question) => {
    setQuestionForm(question);
    setSelectedSection(sections.find(s => s.id === sectionId) || null);
    setEditingQuestionId(question.id);
    setIsQuestionDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!token || !selectedSection) return;

    try {
      setSaving(true);

      // Question types that support options (including medication/allergy/table which store field configs in options)
      const optionTypes = ['dropdown', 'multiple_choice', 'checkbox', 'medication_list', 'allergy_list', 'table'];
      const supportsOptions = optionTypes.includes(questionForm.question_type || '');

      if (editingQuestionId) {
        // Update existing question
        const updated = await updateQuestion(token, editingQuestionId, {
          question_text: questionForm.question_text,
          question_type: questionForm.question_type,
          help_text: questionForm.help_text,
          description: questionForm.description,
          placeholder: questionForm.placeholder,
          is_required: questionForm.is_required,
          is_active: questionForm.is_active,
          persist_annually: questionForm.persist_annually,
          options: supportsOptions ? questionForm.options : [],
          validation_rules: questionForm.validation_rules,
          show_when_status: questionForm.show_when_status,
          template_file_id: questionForm.template_file_id,
          show_if_question_id: questionForm.show_if_question_id,
          show_if_answer: questionForm.show_if_answer,
          detail_prompt_trigger: questionForm.detail_prompt_trigger,
          detail_prompt_text: questionForm.detail_prompt_trigger && questionForm.detail_prompt_trigger.length > 0
            ? (questionForm.detail_prompt_text || 'Please provide details')
            : questionForm.detail_prompt_text,
        });

        setSections(prev =>
          prev.map(section =>
            section.id === selectedSection.id
              ? {
                  ...section,
                  questions: section.questions.map(q =>
                    q.id === editingQuestionId ? updated : q
                  ),
                }
              : section
          )
        );
      } else {
        // Create new question
        const created = await createQuestion(token, {
          section_id: selectedSection.id,
          question_text: questionForm.question_text!,
          question_type: questionForm.question_type!,
          help_text: questionForm.help_text,
          description: questionForm.description,
          placeholder: questionForm.placeholder,
          is_required: questionForm.is_required!,
          is_active: questionForm.is_active!,
          persist_annually: questionForm.persist_annually,
          order_index: selectedSection.questions.length,
          options: supportsOptions ? questionForm.options : [],
          validation_rules: questionForm.validation_rules,
          show_when_status: questionForm.show_when_status,
          template_file_id: questionForm.template_file_id,
          show_if_question_id: questionForm.show_if_question_id,
          show_if_answer: questionForm.show_if_answer,
          detail_prompt_trigger: questionForm.detail_prompt_trigger,
          detail_prompt_text: questionForm.detail_prompt_trigger && questionForm.detail_prompt_trigger.length > 0
            ? (questionForm.detail_prompt_text || 'Please provide details')
            : questionForm.detail_prompt_text,
        });

        setSections(prev =>
          prev.map(section =>
            section.id === selectedSection.id
              ? { ...section, questions: [...section.questions, created] }
              : section
          )
        );
      }

      setSaveStatus('success');
      setIsQuestionDialogOpen(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save question:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const showDeleteQuestionModal = (sectionId: string, questionId: string, questionTitle: string) => {
    setDeleteModal({ type: 'question', sectionId, questionId, questionTitle });
  };

  const handleDeleteQuestion = async () => {
    if (!token || !deleteModal.sectionId || !deleteModal.questionId) return;

    try {
      await deleteQuestion(token, deleteModal.questionId);
      setSections(prev =>
        prev.map(section => {
          if (section.id !== deleteModal.sectionId) return section;
          return {
            ...section,
            questions: section.questions.filter(q => q.id !== deleteModal.questionId),
          };
        })
      );
      toast.success('Question deleted successfully');
      setDeleteModal({ type: null });
    } catch (error) {
      console.error('Failed to delete question:', error);
      toast.error('Failed to delete question');
    }
  };

  const handleDuplicateQuestion = async (sectionId: string, questionId: string) => {
    if (!token) return;

    try {
      setSaving(true);
      const duplicatedQuestion = await duplicateQuestion(token, questionId);

      // Add the duplicated question to the section
      setSections(prev =>
        prev.map(section => {
          if (section.id !== sectionId) return section;

          // Find the index of the original question
          const originalIndex = section.questions.findIndex(q => q.id === questionId);

          // Insert the duplicated question right after the original
          const newQuestions = [...section.questions];
          newQuestions.splice(originalIndex + 1, 0, duplicatedQuestion);

          return {
            ...section,
            questions: newQuestions,
          };
        })
      );

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to duplicate question:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Header handlers
  const handleCreateHeader = (sectionId: string) => {
    setHeaderForm({
      header_text: '',
      is_active: true,
    });
    setSelectedSection(sections.find(s => s.id === sectionId) || null);
    setEditingHeaderId(null);
    setIsHeaderDialogOpen(true);
  };

  const handleEditHeader = (sectionId: string, header: Header) => {
    setHeaderForm({
      header_text: header.header_text,
      is_active: header.is_active,
    });
    setSelectedSection(sections.find(s => s.id === sectionId) || null);
    setEditingHeaderId(header.id);
    setIsHeaderDialogOpen(true);
  };

  const handleSaveHeader = async () => {
    if (!token || !selectedSection) return;

    try {
      setSaving(true);

      if (editingHeaderId) {
        // Update existing header
        const updated = await updateHeader(token, editingHeaderId, {
          header_text: headerForm.header_text,
          is_active: headerForm.is_active,
        });

        setSections(prev =>
          prev.map(section =>
            section.id === selectedSection.id
              ? {
                  ...section,
                  headers: section.headers.map(h =>
                    h.id === editingHeaderId ? updated : h
                  ),
                }
              : section
          )
        );
      } else {
        // Create new header
        const created = await createHeader(token, {
          section_id: selectedSection.id,
          header_text: headerForm.header_text,
          order_index: selectedSection.questions.length + selectedSection.headers.length,
          is_active: headerForm.is_active,
        });

        setSections(prev =>
          prev.map(section =>
            section.id === selectedSection.id
              ? { ...section, headers: [...section.headers, created] }
              : section
          )
        );
      }

      setSaveStatus('success');
      setIsHeaderDialogOpen(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save header:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const showDeleteHeaderModal = (sectionId: string, headerId: string, headerTitle: string) => {
    setDeleteModal({ type: 'header', sectionId, headerId, headerTitle });
  };

  const handleDeleteHeader = async () => {
    if (!token || !deleteModal.sectionId || !deleteModal.headerId) return;

    try {
      await deleteHeader(token, deleteModal.headerId);
      setSections(prev =>
        prev.map(section => {
          if (section.id !== deleteModal.sectionId) return section;
          return {
            ...section,
            headers: section.headers.filter(h => h.id !== deleteModal.headerId),
          };
        })
      );
      toast.success('Header deleted successfully');
      setDeleteModal({ type: null });
    } catch (error) {
      console.error('Failed to delete header:', error);
      toast.error('Failed to delete header');
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const moveSectionUp = async (index: number) => {
    if (!token || index === 0) return;

    try {
      const newSections = [...sections];
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
      newSections.forEach((s, i) => s.order_index = i);
      setSections(newSections);

      // Save new order to backend
      await reorderSections(token, newSections.map(s => s.id));
    } catch (error) {
      console.error('Failed to reorder sections:', error);
      // Reload sections on error
      const data = await getSections(token, true);
      setSections(data);
    }
  };

  const moveSectionDown = async (index: number) => {
    if (!token || index === sections.length - 1) return;

    try {
      const newSections = [...sections];
      [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
      newSections.forEach((s, i) => s.order_index = i);
      setSections(newSections);

      // Save new order to backend
      await reorderSections(token, newSections.map(s => s.id));
    } catch (error) {
      console.error('Failed to reorder sections:', error);
      // Reload sections on error
      const data = await getSections(token, true);
      setSections(data);
    }
  };

  const moveQuestionUp = async (sectionId: string, questionIndex: number) => {
    if (!token || questionIndex === 0) return;

    try {
      const sectionIndex = sections.findIndex(s => s.id === sectionId);
      if (sectionIndex === -1) return;

      const section = sections[sectionIndex];
      const newQuestions = [...section.questions];

      // Swap questions
      [newQuestions[questionIndex - 1], newQuestions[questionIndex]] =
        [newQuestions[questionIndex], newQuestions[questionIndex - 1]];

      // Update order_index
      newQuestions.forEach((q, i) => q.order_index = i);

      // Update state
      const newSections = [...sections];
      newSections[sectionIndex] = { ...section, questions: newQuestions };
      setSections(newSections);

      // Save new order to backend - pass {id, order_index} pairs
      await reorderQuestions(token, newQuestions.map(q => ({ id: q.id, order_index: q.order_index })));
    } catch (error) {
      console.error('Failed to reorder questions:', error);
      // Reload sections on error
      const data = await getSections(token, true);
      setSections(data);
    }
  };

  const moveQuestionDown = async (sectionId: string, questionIndex: number) => {
    if (!token) return;

    try {
      const sectionIndex = sections.findIndex(s => s.id === sectionId);
      if (sectionIndex === -1) return;

      const section = sections[sectionIndex];
      if (questionIndex === section.questions.length - 1) return;

      const newQuestions = [...section.questions];

      // Swap questions
      [newQuestions[questionIndex], newQuestions[questionIndex + 1]] =
        [newQuestions[questionIndex + 1], newQuestions[questionIndex]];

      // Update order_index
      newQuestions.forEach((q, i) => q.order_index = i);

      // Update state
      const newSections = [...sections];
      newSections[sectionIndex] = { ...section, questions: newQuestions };
      setSections(newSections);

      // Save new order to backend - pass {id, order_index} pairs
      await reorderQuestions(token, newQuestions.map(q => ({ id: q.id, order_index: q.order_index })));
    } catch (error) {
      console.error('Failed to reorder questions:', error);
      // Reload sections on error
      const data = await getSections(token, true);
      setSections(data);
    }
  };

  // Helper function to get unified items (headers + questions) sorted by order_index
  const getSectionItems = (section: Section): Array<{ type: 'header' | 'question'; data: Header | Question; order_index: number }> => {
    const items = [
      ...section.headers.map(h => ({ type: 'header' as const, data: h, order_index: h.order_index })),
      ...section.questions.map(q => ({ type: 'question' as const, data: q, order_index: q.order_index }))
    ];
    return items.sort((a, b) => a.order_index - b.order_index);
  };

  // Unified move item up/down
  const moveItemUp = async (sectionId: string, itemIndex: number) => {
    if (!token || itemIndex === 0) return;

    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const items = getSectionItems(section);
    const newItems = [...items];

    // Swap items
    [newItems[itemIndex - 1], newItems[itemIndex]] = [newItems[itemIndex], newItems[itemIndex - 1]];

    // Update order_index for all items
    newItems.forEach((item, i) => {
      item.data.order_index = i;
    });

    // Separate back into headers and questions
    const newHeaders = newItems.filter(item => item.type === 'header').map(item => item.data as Header);
    const newQuestions = newItems.filter(item => item.type === 'question').map(item => item.data as Question);

    // Update state
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, headers: newHeaders, questions: newQuestions } : s));

    // Save to backend - pass {id, order_index} pairs for unified ordering
    try {
      await reorderHeaders(token, newHeaders.map(h => ({ id: h.id, order_index: h.order_index })));
      await reorderQuestions(token, newQuestions.map(q => ({ id: q.id, order_index: q.order_index })));
    } catch (error) {
      console.error('Failed to reorder items:', error);
      const data = await getSections(token, true);
      setSections(data);
    }
  };

  const moveItemDown = async (sectionId: string, itemIndex: number) => {
    if (!token) return;

    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const items = getSectionItems(section);
    if (itemIndex === items.length - 1) return;

    const newItems = [...items];

    // Swap items
    [newItems[itemIndex], newItems[itemIndex + 1]] = [newItems[itemIndex + 1], newItems[itemIndex]];

    // Update order_index for all items
    newItems.forEach((item, i) => {
      item.data.order_index = i;
    });

    // Separate back into headers and questions
    const newHeaders = newItems.filter(item => item.type === 'header').map(item => item.data as Header);
    const newQuestions = newItems.filter(item => item.type === 'question').map(item => item.data as Question);

    // Update state
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, headers: newHeaders, questions: newQuestions } : s));

    // Save to backend - pass {id, order_index} pairs for unified ordering
    try {
      await reorderHeaders(token, newHeaders.map(h => ({ id: h.id, order_index: h.order_index })));
      await reorderQuestions(token, newQuestions.map(q => ({ id: q.id, order_index: q.order_index })));
    } catch (error) {
      console.error('Failed to reorder items:', error);
      const data = await getSections(token, true);
      setSections(data);
    }
  };

  // Unified drag and drop handlers
  const handleItemDragStart = (sectionId: string, itemIndex: number, itemType: 'question' | 'header') => {
    setDraggedItem({ sectionId, itemIndex, itemType });
  };

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  const handleItemDrop = async (targetSectionId: string, targetIndex: number) => {
    if (!draggedItem || !token) return;

    // Can't drag between different sections
    if (draggedItem.sectionId !== targetSectionId) {
      setDraggedItem(null);
      return;
    }

    const { sectionId, itemIndex: sourceIndex } = draggedItem;

    // Same position, no change
    if (sourceIndex === targetIndex) {
      setDraggedItem(null);
      return;
    }

    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    try {
      const items = getSectionItems(section);
      const newItems = [...items];

      // Remove from source position
      const [movedItem] = newItems.splice(sourceIndex, 1);

      // Insert at target position
      newItems.splice(targetIndex, 0, movedItem);

      // Update order_index for all items
      newItems.forEach((item, i) => {
        item.data.order_index = i;
      });

      // Separate back into headers and questions
      const newHeaders = newItems.filter(item => item.type === 'header').map(item => item.data as Header);
      const newQuestions = newItems.filter(item => item.type === 'question').map(item => item.data as Question);

      // Update state
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, headers: newHeaders, questions: newQuestions } : s));

      // Save new order to backend - pass {id, order_index} pairs for unified ordering
      await reorderHeaders(token, newHeaders.map(h => ({ id: h.id, order_index: h.order_index })));
      await reorderQuestions(token, newQuestions.map(q => ({ id: q.id, order_index: q.order_index })));
    } catch (error) {
      console.error('Failed to reorder items:', error);
      // Reload sections on error
      const data = await getSections(token, true);
      setSections(data);
    } finally {
      setDraggedItem(null);
    }
  };

  const handleItemDragEnd = () => {
    setDraggedItem(null);
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...(prev.options || []), ''],
    }));
  };

  const updateOption = (index: number, value: string) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? value : opt),
    }));
  };

  const removeOption = (index: number) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index),
    }));
  };

  // Helper function to get conditional logic information for a question
  const getConditionalLogicInfo = (question: Question) => {
    console.log('Checking conditional logic for:', question.question_text, {
      show_if_question_id: question.show_if_question_id,
      show_if_answer: question.show_if_answer
    });

    if (!question.show_if_question_id || !question.show_if_answer) {
      return null;
    }

    // Find the trigger question across all sections
    for (const section of sections) {
      const triggerQuestion = section.questions.find(q => q.id === question.show_if_question_id);
      if (triggerQuestion) {
        console.log('Found conditional logic:', {
          question: question.question_text,
          trigger: triggerQuestion.question_text,
          answer: question.show_if_answer
        });
        return {
          triggerQuestion,
          triggerAnswer: question.show_if_answer,
          sectionTitle: section.title
        };
      }
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Application Builder</h1>
          <p className="text-muted-foreground mt-1">
            Configure application sections and questions
          </p>
        </div>
        <Button onClick={handleCreateSection}>
          <Plus className="mr-2 h-4 w-4" />
          New Section
        </Button>
      </div>

      {saveStatus === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Changes saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {saveStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to save changes. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {sections.map((section, index) => (
          <Card key={section.id}>
            <CardHeader className="cursor-pointer" onClick={() => toggleSection(section.id)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="pt-0.5">
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 pt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {index + 1}. {section.title}
                      </CardTitle>
                      {!section.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {section.show_when_status !== 'always' && (
                        <Badge variant="outline">
                          {visibilityOptions.find(v => v.value === section.show_when_status)?.label}
                        </Badge>
                      )}
                      {section.required_status && (
                        <Badge variant="outline" className="bg-purple-50 border-purple-300 text-purple-700">
                          {section.required_status === 'applicant' ? 'Applicants Only' : 'Campers Only'}
                        </Badge>
                      )}
                    </div>
                    {section.description && (
                      <CardDescription className="mt-1">{section.description}</CardDescription>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {section.questions.length} question{section.questions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveSectionUp(index)}
                    disabled={index === 0}
                  >
                    <MoveUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveSectionDown(index)}
                    disabled={index === sections.length - 1}
                  >
                    <MoveDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditSection(section)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => showDeleteSectionModal(section.id, section.title)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedSections.has(section.id) && (
              <CardContent>
                <div className="space-y-3">
                  {/* Unified Headers and Questions */}
                  {getSectionItems(section).map((item, itemIndex) => {
                    const items = getSectionItems(section);

                    if (item.type === 'header') {
                      const header = item.data as Header;
                      return (
                        <div
                          key={`header-${header.id}`}
                          draggable
                          onDragStart={() => handleItemDragStart(section.id, itemIndex, 'header')}
                          onDragOver={handleItemDragOver}
                          onDrop={() => handleItemDrop(section.id, itemIndex)}
                          onDragEnd={handleItemDragEnd}
                          className={`group relative rounded-lg transition-all cursor-move ${
                            draggedItem?.sectionId === section.id && draggedItem?.itemIndex === itemIndex
                              ? 'opacity-50'
                              : ''
                          }`}
                        >
                          {/* Sub-section divider header with left accent bar */}
                          <div className={`flex items-center gap-3 py-3 px-4 bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 rounded-lg shadow-sm ${
                            draggedItem?.sectionId === section.id && draggedItem?.itemIndex === itemIndex
                              ? 'border-dashed border-amber-400'
                              : 'hover:shadow-md hover:border-amber-300'
                          }`}>
                            {/* Left accent bar */}
                            <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full" />

                            {/* Drag handle */}
                            <GripVertical className="h-5 w-5 text-amber-500/70 cursor-grab active:cursor-grabbing flex-shrink-0 ml-1" />

                            {/* Header content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-semibold text-amber-900 tracking-tight">
                                  {header.header_text}
                                </h4>
                                {!header.is_active && (
                                  <Badge variant="outline" className="text-xs bg-gray-100 text-gray-500 border-gray-300">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-amber-600/80 mt-0.5">
                                Section Header - Questions below will be grouped under this
                              </p>
                            </div>

                            {/* Action buttons - appear on hover */}
                            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveItemUp(section.id, itemIndex)}
                                disabled={itemIndex === 0}
                                title="Move up"
                                className="h-7 w-7 p-0 hover:bg-amber-100/80"
                              >
                                <MoveUp className="h-3.5 w-3.5 text-amber-700" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveItemDown(section.id, itemIndex)}
                                disabled={itemIndex === items.length - 1}
                                title="Move down"
                                className="h-7 w-7 p-0 hover:bg-amber-100/80"
                              >
                                <MoveDown className="h-3.5 w-3.5 text-amber-700" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditHeader(section.id, header)}
                                title="Edit header"
                                className="h-7 w-7 p-0 hover:bg-amber-100/80"
                              >
                                <Edit className="h-3.5 w-3.5 text-amber-700" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => showDeleteHeaderModal(section.id, header.id, header.header_text)}
                                title="Delete header"
                                className="h-7 w-7 p-0 hover:bg-red-100/80"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const question = item.data as Question;
                      const questionNumber = items.slice(0, itemIndex).filter(i => i.type === 'question').length + 1;
                      return (
                        <div
                          key={`question-${question.id}`}
                          draggable
                          onDragStart={() => handleItemDragStart(section.id, itemIndex, 'question')}
                          onDragOver={handleItemDragOver}
                          onDrop={() => handleItemDrop(section.id, itemIndex)}
                          onDragEnd={handleItemDragEnd}
                          className={`flex items-start gap-3 p-3 bg-muted rounded-lg transition-all cursor-move ${
                            draggedItem?.sectionId === section.id && draggedItem?.itemIndex === itemIndex
                              ? 'opacity-50 border-2 border-dashed border-camp-green'
                              : 'hover:bg-muted/80'
                          }`}
                        >
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {questionNumber}. {question.question_text}
                                {question.is_required && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                              </p>
                              {!question.is_active && (
                                <Badge variant="secondary" className="text-xs">Inactive</Badge>
                              )}
                            </div>
                            {question.help_text && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {question.help_text}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {questionTypes.find(t => t.value === question.question_type)?.label}
                              </Badge>
                              {question.show_when_status !== 'always' && (
                                <Badge variant="outline" className="text-xs">
                                  {visibilityOptions.find(v => v.value === question.show_when_status)?.label}
                                </Badge>
                              )}
                              {question.options && question.options.length > 0 &&
                               ['dropdown', 'multiple_choice', 'checkbox'].includes(question.question_type) && (
                                <Badge variant="outline" className="text-xs">
                                  {question.options.length} options
                                </Badge>
                              )}
                              {(() => {
                                const conditionalInfo = getConditionalLogicInfo(question);
                                if (conditionalInfo) {
                                  return (
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-blue-50 border-blue-300 text-blue-700 flex items-center gap-1"
                                      title={`Shows if "${conditionalInfo.triggerQuestion.question_text}" = "${conditionalInfo.triggerAnswer}"`}
                                    >
                                      <GitBranch className="h-3 w-3" />
                                      Conditional
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              {question.detail_prompt_trigger && Array.isArray(question.detail_prompt_trigger) && question.detail_prompt_trigger.length > 0 && question.detail_prompt_text && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 border-green-300 text-green-700 flex items-center gap-1"
                                  title={`Asks for details when any of these are selected: ${question.detail_prompt_trigger.join(', ')}`}
                                >
                                  <FileText className="h-3 w-3" />
                                  Detail Prompt
                                </Badge>
                              )}
                              {question.template_file_id && question.template_filename && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-purple-50 border-purple-300 text-purple-700 flex items-center gap-1"
                                  title={`Template file: ${question.template_filename}`}
                                >
                                  <Download className="h-3 w-3" />
                                  {question.template_filename}
                                </Badge>
                              )}
                              {question.persist_annually && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-amber-50 border-amber-300 text-amber-700"
                                  title="Response will persist during annual reset"
                                >
                                  📌 Persists Annually
                                </Badge>
                              )}
                            </div>
                            {(() => {
                              const conditionalInfo = getConditionalLogicInfo(question);
                              if (conditionalInfo) {
                                return (
                                  <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded border border-blue-200">
                                    <GitBranch className="h-3 w-3 inline mr-1" />
                                    Shows only if <span className="font-semibold">"{conditionalInfo.triggerQuestion.question_text}"</span> = <span className="font-semibold">"{conditionalInfo.triggerAnswer}"</span>
                                  </p>
                                );
                              }
                              return null;
                            })()}
                            {question.detail_prompt_trigger && Array.isArray(question.detail_prompt_trigger) && question.detail_prompt_trigger.length > 0 && question.detail_prompt_text && (
                              <p className="text-xs text-green-600 mt-2 bg-green-50 p-2 rounded border border-green-200">
                                <FileText className="h-3 w-3 inline mr-1" />
                                Asks for details when any of these are selected: <span className="font-semibold">{question.detail_prompt_trigger.join(', ')}</span> - "{question.detail_prompt_text}"
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveItemUp(section.id, itemIndex)}
                              disabled={itemIndex === 0}
                              title="Move up"
                            >
                              <MoveUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveItemDown(section.id, itemIndex)}
                              disabled={itemIndex === items.length - 1}
                              title="Move down"
                            >
                              <MoveDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditQuestion(section.id, question)}
                              title="Edit question"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicateQuestion(section.id, question.id)}
                              disabled={saving}
                              title="Duplicate question"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => showDeleteQuestionModal(section.id, question.id, question.question_text)}
                              title="Delete question"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                        </div>
                      );
                    }
                  })}

                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateQuestion(section.id)}
                      className="flex-1"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Question
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateHeader(section.id)}
                      className="flex-1 bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Header
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Section Dialog */}
      <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSectionId ? 'Edit Section' : 'Create New Section'}
            </DialogTitle>
            <DialogDescription>
              Configure section details and visibility
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section-title">Section Title *</Label>
              <Input
                id="section-title"
                value={sectionForm.title}
                onChange={(e) => setSectionForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Camper Information"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-description">Description</Label>
              <Textarea
                id="section-description"
                value={sectionForm.description || ''}
                onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this section"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-visibility">When to Show</Label>
              <Select
                value={sectionForm.show_when_status}
                onValueChange={(value: any) =>
                  setSectionForm(prev => ({ ...prev, show_when_status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-status">Application Status</Label>
              <Select
                value={sectionForm.required_status}
                onValueChange={(value: any) =>
                  setSectionForm(prev => ({ ...prev, required_status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <div className="text-sm text-muted-foreground">
                  Section is visible to applicants
                </div>
              </div>
              <Switch
                checked={sectionForm.is_active}
                onCheckedChange={(checked) =>
                  setSectionForm(prev => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection} disabled={saving || !sectionForm.title}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Section'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestionId ? 'Edit Question' : 'Create New Question'}
            </DialogTitle>
            <DialogDescription>
              Configure question details and validation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Section Header - Optional grouping */}
            <div className="space-y-2">
              <Label htmlFor="question-text">Question Text *</Label>
              <Input
                id="question-text"
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
                placeholder="e.g., What is the camper's first name?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-type">Question Type *</Label>
              <Select
                value={questionForm.question_type}
                onValueChange={(value: any) => {
                  const updatedForm: any = { ...questionForm, question_type: value };

                  // Initialize default field configurations for medication and allergy lists
                  if (value === 'medication_list' && !questionForm.options?.medication_fields) {
                    updatedForm.options = {
                      ...questionForm.options,
                      medication_fields: DEFAULT_MEDICATION_FIELDS,
                      dose_fields: DEFAULT_DOSE_FIELDS
                    };
                  } else if (value === 'allergy_list' && !questionForm.options?.allergy_fields) {
                    updatedForm.options = {
                      ...questionForm.options,
                      allergy_fields: DEFAULT_ALLERGY_FIELDS
                    };
                  }

                  setQuestionForm(updatedForm);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="help-text">Help Text</Label>
              <Textarea
                id="help-text"
                value={questionForm.help_text || ''}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, help_text: e.target.value }))}
                placeholder="Additional guidance for applicants"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description (Markdown Supported)
                <span className="text-xs text-muted-foreground ml-2">Optional - Use for long-form content like authorization text</span>
              </Label>
              <Textarea
                id="description"
                value={questionForm.description || ''}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="# Authorization Agreement&#10;&#10;By checking the box below, you agree to:&#10;&#10;- Term 1&#10;- Term 2&#10;- Term 3&#10;&#10;**Bold text** and *italic text* supported"
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supports markdown formatting: **bold**, *italic*, # headers, - bullet lists, [links](url)
              </p>
            </div>

            {/* Template File Upload for file_upload questions */}
            {questionForm.question_type === 'file_upload' && (
              <div className="space-y-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <Label>Template File (Optional)</Label>
                <p className="text-sm text-green-700 mb-2">
                  Upload a template file that families can download, fill out, and re-upload.
                </p>
                {questionForm.template_file_id ? (
                  <div className="flex items-center gap-2 p-3 bg-white rounded border border-green-300">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-sm flex-1 truncate" title={questionForm.template_filename || 'Template file'}>
                      {questionForm.template_filename || 'Template file attached'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!token || !questionForm.template_file_id) return
                        try {
                          const fileInfo = await getTemplateFile(token, questionForm.template_file_id)
                          window.open(fileInfo.url, '_blank')
                        } catch (error) {
                          console.error('Failed to get template file:', error)
                        }
                      }}
                      title="View/Download"
                    >
                      <Download className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuestionForm(prev => ({ ...prev, template_file_id: null, template_filename: null }))}
                      title="Remove template"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file || !token) return

                        try {
                          setSaving(true)
                          const result = await uploadTemplateFile(token, file)
                          setQuestionForm(prev => ({
                            ...prev,
                            template_file_id: result.file_id,
                            template_filename: result.filename
                          }))
                          setSaveStatus('success')
                          setTimeout(() => setSaveStatus('idle'), 2000)
                        } catch (error) {
                          console.error('Failed to upload template:', error)
                          setSaveStatus('error')
                          setTimeout(() => setSaveStatus('idle'), 3000)
                        } finally {
                          setSaving(false)
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, or Excel files (max 10MB)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Options for dropdown/multiple_choice/checkbox */}
            {['dropdown', 'multiple_choice', 'checkbox'].includes(questionForm.question_type || '') && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {questionForm.options?.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="question-visibility">When to Show</Label>
              <Select
                value={questionForm.show_when_status || 'always'}
                onValueChange={(value: any) =>
                  setQuestionForm(prev => ({ ...prev, show_when_status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Conditional Logic */}
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <Label className="text-blue-900 font-semibold">Conditional Logic</Label>
              </div>
              <p className="text-sm text-blue-700">
                Show this question only when a previous question has a specific answer
              </p>

              <div className="space-y-2">
                <Label htmlFor="conditional-question">Show only if...</Label>
                <Select
                  value={questionForm.show_if_question_id || 'none'}
                  onValueChange={(value) => {
                    setQuestionForm(prev => ({
                      ...prev,
                      show_if_question_id: value === 'none' ? null : value,
                      show_if_answer: value === 'none' ? null : prev.show_if_answer
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a question..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Always show (no condition)</SelectItem>
                    {sections.flatMap(section =>
                      section.questions
                        .filter(q => q.id !== editingQuestionId) // Don't show self
                        .filter(q => ['dropdown', 'multiple_choice', 'checkbox'].includes(q.question_type)) // Only questions with options
                        .map(q => (
                          <SelectItem key={q.id} value={q.id}>
                            {section.title} → {q.question_text}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {questionForm.show_if_question_id && questionForm.show_if_question_id !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="conditional-answer">...equals this answer:</Label>
                  {(() => {
                    const triggerQuestion = sections
                      .flatMap(s => s.questions)
                      .find(q => q.id === questionForm.show_if_question_id);

                    if (!triggerQuestion?.options || triggerQuestion.options.length === 0) {
                      return (
                        <Input
                          id="conditional-answer"
                          placeholder="Enter expected answer"
                          value={questionForm.show_if_answer || ''}
                          onChange={(e) =>
                            setQuestionForm(prev => ({ ...prev, show_if_answer: e.target.value }))
                          }
                        />
                      );
                    }

                    return (
                      <Select
                        value={questionForm.show_if_answer || ''}
                        onValueChange={(value) =>
                          setQuestionForm(prev => ({ ...prev, show_if_answer: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an answer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {triggerQuestion.options.map((option, idx) => (
                            <SelectItem key={idx} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                  <p className="text-xs text-blue-600">
                    This question will only appear when the selected question is answered with this value
                  </p>
                </div>
              )}
            </div>

            {/* Detail Prompt - Inline follow-up question */}
            {['dropdown', 'multiple_choice', 'checkbox'].includes(questionForm.question_type || '') && (
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <Label className="text-base font-semibold text-green-900">Detail Prompt</Label>
                </div>
                <p className="text-sm text-green-700">
                  Show a textarea asking for details when a specific answer is selected (e.g., "Yes" → "Please provide details")
                </p>

                <div className="space-y-2">
                  <Label>Show detail prompt when any of these answers are selected:</Label>
                  {questionForm.options && questionForm.options.length > 0 ? (
                    <div className="space-y-2 bg-white p-3 rounded-lg border border-green-300">
                      {questionForm.options.map((option, idx) => (
                        <label key={idx} className="flex items-center space-x-2 cursor-pointer hover:bg-green-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={questionForm.detail_prompt_trigger?.includes(option) || false}
                            onChange={(e) => {
                              const triggers = questionForm.detail_prompt_trigger || [];
                              setQuestionForm(prev => ({
                                ...prev,
                                detail_prompt_trigger: e.target.checked
                                  ? [...triggers, option]
                                  : triggers.filter(t => t !== option)
                              }));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm font-medium">{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Add options above to enable detail prompts
                    </p>
                  )}
                </div>

                {questionForm.detail_prompt_trigger && questionForm.detail_prompt_trigger.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="detail-prompt-text">Detail prompt text:</Label>
                    <Textarea
                      id="detail-prompt-text"
                      value={questionForm.detail_prompt_text || ''}
                      onChange={(e) => setQuestionForm(prev => ({ ...prev, detail_prompt_text: e.target.value }))}
                      placeholder="Please provide details..."
                      rows={3}
                    />
                    <p className="text-xs text-green-600">
                      When any of these answers are selected: <span className="font-semibold">{questionForm.detail_prompt_trigger.join(', ')}</span>, a textarea will appear below asking for these details
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Field Configuration for Medication and Allergy Lists */}
            {questionForm.question_type === 'medication_list' && (
              <div className="space-y-6 p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-purple-900">Configure Medication Fields</h3>
                </div>
                <p className="text-sm text-purple-700 mb-4">
                  Customize the fields that families will fill out for each medication and dose schedule.
                </p>

                <FieldConfigurator
                  title="Medication Information Fields"
                  fields={questionForm.options?.medication_fields || DEFAULT_MEDICATION_FIELDS}
                  onChange={(fields) => setQuestionForm(prev => ({
                    ...prev,
                    options: { ...prev.options, medication_fields: fields }
                  }))}
                />

                <Separator className="my-6" />

                <FieldConfigurator
                  title="Dose Schedule Fields"
                  fields={questionForm.options?.dose_fields || DEFAULT_DOSE_FIELDS}
                  onChange={(fields) => setQuestionForm(prev => ({
                    ...prev,
                    options: { ...prev.options, dose_fields: fields }
                  }))}
                />
              </div>
            )}

            {questionForm.question_type === 'allergy_list' && (
              <div className="space-y-6 p-6 bg-orange-50 rounded-lg border-2 border-orange-200">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-orange-900">Configure Allergy Fields</h3>
                </div>
                <p className="text-sm text-orange-700 mb-4">
                  Customize the fields that families will fill out for each allergy.
                </p>

                <FieldConfigurator
                  title="Allergy Information Fields"
                  fields={questionForm.options?.allergy_fields || DEFAULT_ALLERGY_FIELDS}
                  onChange={(fields) => setQuestionForm(prev => ({
                    ...prev,
                    options: { ...prev.options, allergy_fields: fields }
                  }))}
                />
              </div>
            )}

            {questionForm.question_type === 'table' && (
              <div className="space-y-6 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">Configure Table Columns</h3>
                </div>
                <p className="text-sm text-blue-700 mb-4">
                  Customize the columns that will appear in the table. Users can add multiple rows.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <Label htmlFor="addButtonText">Add Button Text</Label>
                    <Input
                      id="addButtonText"
                      value={questionForm.options?.addButtonText || 'Add Row'}
                      onChange={(e) => setQuestionForm(prev => ({
                        ...prev,
                        options: { ...prev.options, addButtonText: e.target.value }
                      }))}
                      placeholder="e.g., Add Entry, Add Item"
                    />
                  </div>

                  <div>
                    <Label htmlFor="emptyStateText">Empty State Message</Label>
                    <Input
                      id="emptyStateText"
                      value={questionForm.options?.emptyStateText || ''}
                      onChange={(e) => setQuestionForm(prev => ({
                        ...prev,
                        options: { ...prev.options, emptyStateText: e.target.value }
                      }))}
                      placeholder="e.g., No entries yet. Click Add Row to get started."
                    />
                  </div>
                </div>

                <FieldConfigurator
                  title="Table Columns"
                  fields={questionForm.options?.columns || []}
                  onChange={(fields) => setQuestionForm(prev => ({
                    ...prev,
                    options: { ...prev.options, columns: fields }
                  }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Required</Label>
                  <div className="text-sm text-muted-foreground">
                    Must be answered
                  </div>
                </div>
                <Switch
                  checked={questionForm.is_required}
                  onCheckedChange={(checked) =>
                    setQuestionForm(prev => ({ ...prev, is_required: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <div className="text-sm text-muted-foreground">
                    Visible to applicants
                  </div>
                </div>
                <Switch
                  checked={questionForm.is_active}
                  onCheckedChange={(checked) =>
                    setQuestionForm(prev => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
            </div>

            {/* Persist Annually toggle */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-amber-900">Persist Annually</Label>
                  <div className="text-sm text-amber-700">
                    Keep this response during annual reset (e.g., camper name, date of birth)
                  </div>
                </div>
                <Switch
                  checked={questionForm.persist_annually || false}
                  onCheckedChange={(checked) =>
                    setQuestionForm(prev => ({ ...prev, persist_annually: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion} disabled={saving || !questionForm.question_text}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Question'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Dialog */}
      <Dialog open={isHeaderDialogOpen} onOpenChange={setIsHeaderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHeaderId ? 'Edit Header' : 'Create New Header'}</DialogTitle>
            <DialogDescription>
              Headers help organize and group related questions visually.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="header-text">Header Text *</Label>
              <Input
                id="header-text"
                value={headerForm.header_text}
                onChange={(e) => setHeaderForm(prev => ({ ...prev, header_text: e.target.value }))}
                placeholder="e.g., Medical Information, Emergency Contact, etc."
                className="bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="header-active"
                checked={headerForm.is_active}
                onCheckedChange={(checked) => setHeaderForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="header-active" className="cursor-pointer">
                Active (visible to applicants)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHeaderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHeader} disabled={saving || !headerForm.header_text}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Header'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.type === 'section'}
        onClose={() => setDeleteModal({ type: null })}
        onConfirm={handleDeleteSection}
        title="Delete Section"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold">"{deleteModal.sectionTitle}"</span>?
            <div className="mt-3 p-3 bg-red-50 rounded-lg text-xs text-red-800">
              <p>All questions in this section will also be deleted. This action cannot be undone.</p>
            </div>
          </>
        }
        confirmLabel="Delete Section"
        theme="danger"
      />

      {/* Delete Question Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.type === 'question'}
        onClose={() => setDeleteModal({ type: null })}
        onConfirm={handleDeleteQuestion}
        title="Delete Question"
        message={
          <>
            Are you sure you want to delete this question?
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700 font-medium truncate">
              "{deleteModal.questionTitle}"
            </div>
          </>
        }
        confirmLabel="Delete Question"
        theme="danger"
      />

      {/* Delete Header Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.type === 'header'}
        onClose={() => setDeleteModal({ type: null })}
        onConfirm={handleDeleteHeader}
        title="Delete Header"
        message={
          <>
            Are you sure you want to delete this header?
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700 font-medium truncate">
              "{deleteModal.headerTitle}"
            </div>
          </>
        }
        confirmLabel="Delete Header"
        theme="danger"
      />
    </div>
  );
}
