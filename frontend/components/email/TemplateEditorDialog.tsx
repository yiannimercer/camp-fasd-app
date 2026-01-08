'use client';

/**
 * TemplateEditorDialog - Full-featured email template editor
 *
 * A spacious, professional template editor with:
 * - Large markdown editing area with live preview
 * - Variable mockup panel to preview all available variables
 * - Real-time email preview with CAMP branding
 * - Responsive design for various screen sizes
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  X,
  Eye,
  Code,
  FileText,
  Variable,
  RefreshCw,
  Loader2,
  Save,
  HelpCircle,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Mail,
  Settings2,
  PanelLeftClose,
  PanelLeft,
  MousePointerClick,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamic import markdown editor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

/**
 * MASTER LIST OF ALL KNOWN TEMPLATE VARIABLES
 *
 * This comprehensive list includes every variable used across all email templates.
 * Each variable has a default mock value for preview purposes.
 * The sidebar dynamically shows only variables that are USED in the current template.
 */
const ALL_KNOWN_VARIABLES: Record<string, { label: string; description: string; category: string; default: string }> = {
  // ==================== RECIPIENT INFO ====================
  firstName: { label: 'First Name', description: 'Recipient first name', category: 'Recipient', default: 'John' },
  lastName: { label: 'Last Name', description: 'Recipient last name', category: 'Recipient', default: 'Doe' },

  // ==================== CAMPER INFO ====================
  camperName: { label: 'Camper Full Name', description: 'Full camper name', category: 'Camper', default: 'Sarah Smith' },
  camperFirstName: { label: 'Camper First Name', description: 'Camper first name only', category: 'Camper', default: 'Sarah' },
  camperLastName: { label: 'Camper Last Name', description: 'Camper last name only', category: 'Camper', default: 'Smith' },

  // ==================== APPLICATION INFO ====================
  completionPercentage: { label: 'Completion %', description: 'Application progress (0-100)', category: 'Application', default: '75' },
  status: { label: 'Status', description: 'Main application status', category: 'Application', default: 'camper' },
  subStatus: { label: 'Sub-Status', description: 'Detailed status', category: 'Application', default: 'incomplete' },

  // ==================== PAYMENT INFO ====================
  tuitionAmount: { label: 'Tuition Amount', description: 'Camp fee from settings', category: 'Payment', default: '$1,095' },
  remainingBalance: { label: 'Remaining Balance', description: 'Outstanding balance amount', category: 'Payment', default: '$1,095' },
  amountPaid: { label: 'Amount Paid', description: 'Payment amount received', category: 'Payment', default: '$500' },
  totalAmount: { label: 'Total Amount', description: 'Total registration cost', category: 'Payment', default: '$1,095' },
  scholarshipAmount: { label: 'Scholarship Amount', description: 'Scholarship value awarded', category: 'Payment', default: '$500' },
  originalAmount: { label: 'Original Amount', description: 'Original tuition before scholarship', category: 'Payment', default: '$1,095' },
  newAmount: { label: 'New Amount', description: 'Balance after scholarship', category: 'Payment', default: '$595' },
  numberOfPayments: { label: 'Number of Payments', description: 'Payment plan installments', category: 'Payment', default: '3' },
  paymentBreakdown: { label: 'Payment Breakdown', description: 'Payment schedule details', category: 'Payment', default: '• Payment 1: $365 (Due: June 1)\n• Payment 2: $365 (Due: July 1)\n• Payment 3: $365 (Due: August 1)' },

  // ==================== URLs ====================
  appUrl: { label: 'App URL', description: 'Application portal link', category: 'URLs', default: 'https://app.fasdcamp.org' },
  paymentUrl: { label: 'Payment URL', description: 'Direct payment page link', category: 'URLs', default: 'https://app.fasdcamp.org/dashboard' },
  websiteUrl: { label: 'Website URL', description: 'Main website link', category: 'URLs', default: 'https://fasdcamp.org' },
  parentInfoPacketUrl: { label: 'Parent Info Packet URL', description: 'Link to parent information packet', category: 'URLs', default: 'https://app.fasdcamp.org/documents/parent-info-packet.pdf' },
  applicationUrl: { label: 'Application URL', description: 'Direct link to specific application', category: 'URLs', default: '/admin/applications/123' },

  // ==================== CAMP INFO ====================
  campYear: { label: 'Camp Year', description: 'Current camp year', category: 'Camp', default: '2025' },
  organizationName: { label: 'Organization', description: 'Organization name', category: 'Camp', default: 'CAMP - A FASD Community' },
  currentYear: { label: 'Current Year', description: 'Current calendar year', category: 'Camp', default: new Date().getFullYear().toString() },

  // ==================== ADMIN DIGEST METRICS ====================
  digestDate: { label: 'Digest Date', description: 'Date of the digest report', category: 'Admin Digest', default: 'January 6, 2025' },
  totalApplications: { label: 'Total Applications', description: 'Total number of applications', category: 'Admin Digest', default: '127' },
  acceptedCampers: { label: 'Accepted Campers', description: 'Number of accepted campers', category: 'Admin Digest', default: '45' },
  paidCampers: { label: 'Paid Campers', description: 'Campers who have paid', category: 'Admin Digest', default: '32' },
  unpaidCampers: { label: 'Unpaid Campers', description: 'Accepted but unpaid campers', category: 'Admin Digest', default: '13' },
  newThisWeek: { label: 'New This Week', description: 'Applications started this week', category: 'Admin Digest', default: '8' },
  notStarted: { label: 'Not Started', description: 'Applications at 0%', category: 'Admin Digest', default: '15' },
  incomplete: { label: 'Incomplete', description: 'Applications in progress', category: 'Admin Digest', default: '42' },
  complete: { label: 'Complete', description: 'Applications at 100%', category: 'Admin Digest', default: '25' },
  underReview: { label: 'Under Review', description: 'Applications being reviewed', category: 'Admin Digest', default: '12' },
  waitlisted: { label: 'Waitlisted', description: 'Waitlisted applications', category: 'Admin Digest', default: '8' },
};

// Convert the master list to array format for the "Insert Variable" dropdown
const ALL_VARIABLES_ARRAY = Object.entries(ALL_KNOWN_VARIABLES).map(([key, data]) => ({
  key,
  ...data,
}));

// Extract all {{variableName}} patterns from content
function extractVariablesFromContent(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

// Convert camelCase to human-readable label
function camelToLabel(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// Markdown reference
const MARKDOWN_REFERENCE = [
  { syntax: '# Heading 1', description: 'Large heading' },
  { syntax: '## Heading 2', description: 'Medium heading' },
  { syntax: '### Heading 3', description: 'Small heading' },
  { syntax: '**bold**', description: 'Bold text' },
  { syntax: '*italic*', description: 'Italic text' },
  { syntax: '[Link](url)', description: 'Hyperlink' },
  { syntax: '[Text →](url "button:orange")', description: 'CTA Button' },
  { syntax: '- Item', description: 'Bullet list' },
  { syntax: '> Quote', description: 'Block quote' },
  { syntax: '---', description: 'Horizontal line' },
];

interface EmailDocument {
  id: string;
  name: string;
  url: string;
}

interface TemplateData {
  id?: string;
  key: string;
  name: string;
  subject: string;
  html_content: string;
  text_content?: string | null;
  markdown_content?: string | null;
  use_markdown?: boolean;
  is_active?: boolean;
  variables?: string[] | null;
}

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateData | null;
  isCreating?: boolean;
  onSave: (template: TemplateData) => Promise<void>;
  onPreview: (subject: string, content: string, isMarkdown: boolean, variables: Record<string, string>) => Promise<string>;
  documents?: EmailDocument[];
  onLoadDocuments?: () => void;
}

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  isCreating = false,
  onSave,
  onPreview,
  documents = [],
  onLoadDocuments,
}: TemplateEditorDialogProps) {
  // Form state
  const [formData, setFormData] = useState<TemplateData>({
    key: '',
    name: '',
    subject: '',
    html_content: '',
    markdown_content: '',
    use_markdown: true,
    is_active: true,
  });

  // UI state
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewOutdated, setPreviewOutdated] = useState(false);
  const [variablesPanelOpen, setVariablesPanelOpen] = useState(true);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // CTA Button insertion state
  const [buttonPopoverOpen, setButtonPopoverOpen] = useState(false);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonColor, setButtonColor] = useState<'green' | 'orange'>('orange');

  // Variable mock values
  const [mockVariables, setMockVariables] = useState<Record<string, string>>({});

  /**
   * ACTIVE VARIABLES - Only variables that are CURRENTLY USED in the template content
   * These appear in the sidebar for mocking. As users add/remove variables from
   * the markdown, this list updates in real-time.
   */
  const activeVariables = useMemo(() => {
    const content = (formData.subject || '') + (formData.markdown_content || '') + (formData.html_content || '');
    const usedKeys = extractVariablesFromContent(content);

    // Map each used variable to its known metadata, or create a generic entry for unknowns
    return usedKeys.map(key => {
      const known = ALL_KNOWN_VARIABLES[key];
      if (known) {
        return { key, ...known };
      }
      // Unknown variable - generate reasonable defaults
      return {
        key,
        label: camelToLabel(key),
        description: 'Custom template variable',
        category: 'Custom',
        default: key.toLowerCase().includes('url') ? 'https://example.com' :
                 key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance') ? '$100' :
                 key.toLowerCase().includes('date') ? new Date().toLocaleDateString() :
                 key.toLowerCase().includes('count') || key.toLowerCase().includes('total') ? '42' :
                 key.toLowerCase().includes('percent') ? '75' :
                 '{{sample}}',
      };
    });
  }, [formData.subject, formData.markdown_content, formData.html_content]);

  // Initialize form data when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        ...template,
        markdown_content: template.markdown_content || '',
        use_markdown: template.use_markdown ?? true,
      });
      setPreviewHtml('');
      setPreviewOutdated(false);
    } else {
      setFormData({
        key: '',
        name: '',
        subject: '',
        html_content: '',
        markdown_content: '',
        use_markdown: true,
        is_active: true,
      });
    }
    // Reset mock variables when opening a new template
    setMockVariables({});
  }, [template, open]);

  // CRITICAL: Ensure body scroll is restored when dialog closes
  // Radix UI's RemoveScroll can sometimes fail to clean up properly,
  // especially with nested popovers and dynamic imports (MDEditor)
  useEffect(() => {
    if (!open) {
      // Close any open popovers immediately
      setButtonPopoverOpen(false);

      // When dialog closes, ensure body scroll is restored
      // Use a small delay to let Radix finish its cleanup first
      const cleanup = setTimeout(() => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        // Also remove any data attributes that might be lingering
        document.body.removeAttribute('data-scroll-locked');
      }, 100);
      return () => clearTimeout(cleanup);
    }
  }, [open]);

  /**
   * Sync mock variables with active variables
   * When variables are added to the content, initialize their mock values
   * When variables are removed, we keep their mock values (in case user re-adds them)
   */
  useEffect(() => {
    if (activeVariables.length > 0) {
      setMockVariables(prev => {
        const updated = { ...prev };
        activeVariables.forEach(v => {
          // Only set default if not already set
          if (!(v.key in updated)) {
            updated[v.key] = v.default;
          }
        });
        return updated;
      });
    }
  }, [activeVariables]);

  // Mark preview as outdated when content changes
  const handleContentChange = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (previewHtml && ['markdown_content', 'html_content', 'subject', 'use_markdown'].includes(field)) {
      setPreviewOutdated(true);
    }
  }, [previewHtml]);

  // Update mock variable
  const handleMockVariableChange = useCallback((key: string, value: string) => {
    setMockVariables(prev => ({ ...prev, [key]: value }));
    if (previewHtml) {
      setPreviewOutdated(true);
    }
  }, [previewHtml]);

  // Generate preview
  const handleGeneratePreview = useCallback(async () => {
    const content = formData.use_markdown ? formData.markdown_content : formData.html_content;
    if (!content) return;

    try {
      setPreviewLoading(true);
      const html = await onPreview(
        formData.subject || 'Preview Subject',
        content || '',
        formData.use_markdown || false,
        mockVariables
      );
      setPreviewHtml(html);
      setPreviewOutdated(false);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  }, [formData, mockVariables, onPreview]);

  // Save template
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await onSave(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setSaving(false);
    }
  }, [formData, onSave, onOpenChange]);

  // Insert variable into markdown
  const insertVariable = useCallback((varKey: string) => {
    const varText = `{{${varKey}}}`;
    // Try to insert at cursor position in the editor
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    if (textarea && formData.use_markdown) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = formData.markdown_content || '';
      const newContent = currentContent.substring(0, start) + varText + currentContent.substring(end);
      handleContentChange('markdown_content', newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + varText.length, start + varText.length);
      }, 0);
    } else {
      // Fallback: append to end
      const content = formData.use_markdown ? formData.markdown_content : formData.html_content;
      const field = formData.use_markdown ? 'markdown_content' : 'html_content';
      handleContentChange(field, (content || '') + varText);
    }
  }, [formData, handleContentChange]);

  // Copy variable to clipboard
  const copyVariable = useCallback((varKey: string) => {
    navigator.clipboard.writeText(`{{${varKey}}}`);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 2000);
  }, []);

  // Insert CTA button markdown
  // Uses format: [Button Text →](url "button:color")
  // Backend recognizes the "button:color" title attribute to style as CTA
  const insertButton = useCallback(() => {
    if (!buttonText.trim() || !buttonUrl.trim()) return;

    const buttonMarkdown = `[${buttonText.trim()} →](${buttonUrl.trim()} "button:${buttonColor}")`;

    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    if (textarea && formData.use_markdown) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = formData.markdown_content || '';
      const newContent = currentContent.substring(0, start) + buttonMarkdown + currentContent.substring(end);
      handleContentChange('markdown_content', newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + buttonMarkdown.length, start + buttonMarkdown.length);
      }, 0);
    } else {
      const content = formData.markdown_content || '';
      handleContentChange('markdown_content', content + buttonMarkdown);
    }

    // Reset and close popover
    setButtonText('');
    setButtonUrl('');
    setButtonColor('orange');
    setButtonPopoverOpen(false);
  }, [buttonText, buttonUrl, buttonColor, formData.use_markdown, formData.markdown_content, handleContentChange]);

  // Current content for editing
  const currentContent = formData.use_markdown ? formData.markdown_content : formData.html_content;
  const contentField = formData.use_markdown ? 'markdown_content' : 'html_content';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 overflow-hidden"
        style={{ maxWidth: '1600px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-slate-100/80">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-camp-green/10 rounded-lg">
              <Mail className="h-5 w-5 text-camp-green" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {isCreating ? 'Create Template' : 'Edit Template'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Design your email with live preview
              </p>
            </div>
          </div>
          <Badge
            variant={formData.is_active ? 'default' : 'secondary'}
            className={cn(
              "text-xs cursor-pointer transition-colors",
              formData.is_active
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
            onClick={() => handleContentChange('is_active', !formData.is_active)}
          >
            {formData.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Variable Mockups (Collapsible) */}
          <div
            className={cn(
              "border-r bg-slate-50/50 transition-all duration-300 ease-in-out overflow-hidden flex flex-col",
              variablesPanelOpen ? "w-72" : "w-0"
            )}
          >
            <div className="p-4 border-b bg-white/50 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Variable Preview</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Customize values to see real email output
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeVariables.length === 0 ? (
                /* Empty State - No variables used yet */
                <div className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                    <Variable className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">No variables in use</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Add variables like <code className="bg-muted px-1 rounded">{`{{firstName}}`}</code> to your template and they&apos;ll appear here for preview customization.
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Use the &quot;Insert Variable&quot; button in the editor toolbar.
                  </p>
                </div>
              ) : (
                /* Active Variables - Grouped by Category */
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {activeVariables.length} variable{activeVariables.length !== 1 ? 's' : ''} in use
                    </span>
                  </div>

                  {/* Group active variables by category */}
                  {[...new Set(activeVariables.map(v => v.category))].map((category) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span className="h-px flex-1 bg-border" />
                        {category}
                        <span className="h-px flex-1 bg-border" />
                      </h4>
                      <div className="space-y-3">
                        {activeVariables
                          .filter(v => v.category === category)
                          .map((variable) => (
                            <div key={variable.key} className="group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-gray-700">
                                  {variable.label}
                                </label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => copyVariable(variable.key)}
                                  title="Copy variable"
                                >
                                  {copiedVar === variable.key ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                              <Input
                                value={mockVariables[variable.key] || ''}
                                onChange={(e) => handleMockVariableChange(variable.key, e.target.value)}
                                placeholder={variable.default}
                                className="h-8 text-sm bg-white"
                              />
                              <code className="text-[10px] text-orange-600/70 mt-1 block">
                                {`{{${variable.key}}}`}
                              </code>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Toggle Panel Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-4 p-0 rounded-l-none bg-slate-100 hover:bg-slate-200 border border-l-0"
            style={{ left: variablesPanelOpen ? '288px' : '0px' }}
            onClick={() => setVariablesPanelOpen(!variablesPanelOpen)}
          >
            {variablesPanelOpen ? (
              <PanelLeftClose className="h-3 w-3" />
            ) : (
              <PanelLeft className="h-3 w-3" />
            )}
          </Button>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Template Info Row */}
            <div className="px-6 py-4 border-b bg-white flex gap-4">
              {isCreating && (
                <div className="w-48">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Template Key</Label>
                  <Input
                    value={formData.key}
                    onChange={(e) => handleContentChange('key', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    placeholder="e.g., welcome_email"
                    className="h-9"
                  />
                </div>
              )}
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Template Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleContentChange('name', e.target.value)}
                  placeholder="e.g., Welcome Email"
                  className="h-9"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Email Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => handleContentChange('subject', e.target.value)}
                  placeholder="Email subject line with {{variables}}"
                  className="h-9"
                />
              </div>
            </div>

            {/* Tabs: Edit / Preview */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-2 border-b bg-slate-50/50 flex items-center justify-between">
                <TabsList className="bg-white shadow-sm">
                  <TabsTrigger value="edit" className="gap-2 data-[state=active]:bg-camp-green/10">
                    <Code className="h-3.5 w-3.5" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2 data-[state=active]:bg-camp-green/10">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-4">
                  {/* Markdown Toggle */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border">
                    <Switch
                      id="use-markdown"
                      checked={formData.use_markdown ?? false}
                      onCheckedChange={(checked) => handleContentChange('use_markdown', checked)}
                      className="data-[state=checked]:bg-camp-green"
                    />
                    <Label htmlFor="use-markdown" className="text-xs font-medium cursor-pointer">
                      {formData.use_markdown ? 'Markdown Mode' : 'HTML Mode'}
                    </Label>
                  </div>

                  {/* Refresh Preview */}
                  {activeTab === 'preview' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGeneratePreview}
                      disabled={previewLoading}
                      className="gap-2"
                    >
                      {previewLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Refresh Preview
                    </Button>
                  )}
                </div>
              </div>

              {/* Edit Tab */}
              <TabsContent value="edit" className="flex-1 m-0 overflow-hidden">
                <div className="h-full flex flex-col">
                  {formData.use_markdown ? (
                    <>
                      {/* Markdown Editor Toolbar Extras */}
                      <div className="px-6 py-2 border-b bg-white flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-8">
                              <Variable className="h-3.5 w-3.5" />
                              Insert Variable
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 p-0" align="start">
                            <div className="p-3 border-b bg-muted/30">
                              <h4 className="font-medium text-sm">Insert Variable</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">Click any variable to insert at cursor position</p>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                              {/* All Variables Grouped by Category */}
                              {[...new Set(ALL_VARIABLES_ARRAY.map(v => v.category))].map((category) => (
                                <div key={category} className="p-2 border-b last:border-b-0">
                                  <div className="flex items-center gap-2 px-2 py-1 mb-1">
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                      {category}
                                    </span>
                                  </div>
                                  {ALL_VARIABLES_ARRAY
                                    .filter(v => v.category === category)
                                    .map((v) => (
                                      <div
                                        key={v.key}
                                        className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer"
                                        onClick={() => insertVariable(v.key)}
                                      >
                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-orange-600">
                                          {`{{${v.key}}}`}
                                        </code>
                                        <span className="text-xs text-muted-foreground truncate ml-2">{v.label}</span>
                                      </div>
                                    ))}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Insert Document Link */}
                        <Popover onOpenChange={(open) => {
                          if (open && onLoadDocuments) {
                            onLoadDocuments();
                          }
                        }}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-8">
                              <FileText className="h-3.5 w-3.5" />
                              Insert Document
                              {documents.length > 0 && (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                                  {documents.length}
                                </Badge>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <div className="p-3 border-b bg-gradient-to-r from-blue-50 to-transparent">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <h4 className="font-medium text-sm">Insert Document Link</h4>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Link to uploaded documents (PDFs, forms, etc.)
                              </p>
                            </div>
                            {documents.length === 0 ? (
                              <div className="p-6 text-center">
                                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                                  <FileText className="h-6 w-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-700 mb-1">No documents uploaded</p>
                                <p className="text-xs text-muted-foreground mb-4">
                                  Upload documents in the "Documents" tab first, then you can insert links to them here.
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Great for linking info packets, medical forms, or waivers.
                                </p>
                              </div>
                            ) : (
                              <div className="p-2 max-h-64 overflow-y-auto">
                                {documents.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className="flex items-center gap-3 py-2.5 px-3 hover:bg-blue-50 rounded-md cursor-pointer group transition-colors"
                                    onClick={() => {
                                      const content = formData.markdown_content || '';
                                      handleContentChange('markdown_content', content + `[📄 ${doc.name}](${doc.url})`);
                                    }}
                                  >
                                    <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                      <FileText className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{doc.name}</p>
                                      <p className="text-[10px] text-muted-foreground">Click to insert link</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>

                        {/* CTA Button Insertion */}
                        <Popover open={buttonPopoverOpen} onOpenChange={setButtonPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-8 border-dashed border-camp-orange/50 hover:border-camp-orange hover:bg-camp-orange/5">
                              <MousePointerClick className="h-3.5 w-3.5 text-camp-orange" />
                              Add Button
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <div className="p-3 border-b bg-gradient-to-r from-camp-orange/10 to-transparent">
                              <div className="flex items-center gap-2">
                                <MousePointerClick className="h-4 w-4 text-camp-orange" />
                                <h4 className="font-medium text-sm">Insert CTA Button</h4>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Create a styled call-to-action button
                              </p>
                            </div>
                            <div className="p-4 space-y-4">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                  Button Text
                                </Label>
                                <Input
                                  value={buttonText}
                                  onChange={(e) => setButtonText(e.target.value)}
                                  placeholder="e.g., Make a Payment"
                                  className="h-9"
                                />
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                  Button URL
                                </Label>
                                <Input
                                  value={buttonUrl}
                                  onChange={(e) => setButtonUrl(e.target.value)}
                                  placeholder="e.g., {{paymentUrl}} or https://..."
                                  className="h-9"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  You can use variables like {`{{appUrl}}`} or {`{{paymentUrl}}`}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                                  Button Color
                                </Label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setButtonColor('orange')}
                                    className={cn(
                                      "flex-1 h-9 rounded-md border-2 transition-all flex items-center justify-center gap-2",
                                      buttonColor === 'orange'
                                        ? "border-camp-orange bg-camp-orange text-white"
                                        : "border-gray-200 hover:border-camp-orange/50"
                                    )}
                                  >
                                    <span className="w-3 h-3 rounded-full bg-camp-orange" style={{ boxShadow: buttonColor === 'orange' ? 'none' : undefined }} />
                                    <span className="text-xs font-medium">Orange</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setButtonColor('green')}
                                    className={cn(
                                      "flex-1 h-9 rounded-md border-2 transition-all flex items-center justify-center gap-2",
                                      buttonColor === 'green'
                                        ? "border-camp-green bg-camp-green text-white"
                                        : "border-gray-200 hover:border-camp-green/50"
                                    )}
                                  >
                                    <span className="w-3 h-3 rounded-full bg-camp-green" />
                                    <span className="text-xs font-medium">Green</span>
                                  </button>
                                </div>
                              </div>
                              {/* Preview */}
                              {buttonText && (
                                <div className="pt-2 border-t">
                                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                                    Preview
                                  </Label>
                                  <div
                                    className={cn(
                                      "inline-flex items-center justify-center px-6 py-2.5 rounded-md text-white text-sm font-semibold",
                                      buttonColor === 'orange' ? "bg-camp-orange" : "bg-camp-green"
                                    )}
                                  >
                                    {buttonText} →
                                  </div>
                                </div>
                              )}
                              <Button
                                onClick={insertButton}
                                disabled={!buttonText.trim() || !buttonUrl.trim()}
                                className="w-full bg-camp-green hover:bg-camp-green/90"
                              >
                                Insert Button
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>

                        <div className="flex-1" />

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2 h-8 text-muted-foreground">
                              <HelpCircle className="h-3.5 w-3.5" />
                              Markdown Help
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-0" align="end">
                            <div className="p-3 border-b bg-muted/30">
                              <h4 className="font-medium text-sm">Reference</h4>
                            </div>
                            <div className="p-3 space-y-2">
                              {MARKDOWN_REFERENCE.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.syntax}</code>
                                  <span className="text-xs text-muted-foreground">{item.description}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Markdown Editor */}
                      <div className="flex-1 overflow-hidden" data-color-mode="light">
                        <MDEditor
                          value={formData.markdown_content || ''}
                          onChange={(val) => handleContentChange('markdown_content', val || '')}
                          height="100%"
                          preview="live"
                          hideToolbar={false}
                          style={{ height: '100%' }}
                          textareaProps={{
                            placeholder: 'Write your email content in Markdown...\n\nUse {{variableName}} for dynamic content.',
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    /* HTML Textarea */
                    <div className="flex-1 p-6">
                      <Textarea
                        value={formData.html_content || ''}
                        onChange={(e) => handleContentChange('html_content', e.target.value)}
                        placeholder="Enter HTML content..."
                        className="h-full font-mono text-sm resize-none"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Preview Tab */}
              <TabsContent value="preview" className="flex-1 m-0 p-6 bg-slate-100/50 overflow-hidden">
                <div className="h-full bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col">
                  {previewOutdated && previewHtml && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                      <span className="text-sm text-amber-700">Preview is outdated</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGeneratePreview}
                        disabled={previewLoading}
                        className="h-7 text-amber-700 hover:text-amber-800"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                    </div>
                  )}

                  {previewHtml ? (
                    <iframe
                      srcDoc={previewHtml}
                      className="flex-1 w-full border-0"
                      title="Email Preview"
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center max-w-sm">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                          <Eye className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="font-medium text-lg mb-2">Preview Your Email</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Click "Refresh Preview" to see how your email will look with CAMP branding and your custom variable values.
                        </p>
                        <Button onClick={handleGeneratePreview} disabled={previewLoading} className="bg-camp-green hover:bg-camp-green/90">
                          {previewLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Eye className="h-4 w-4 mr-2" />
                          )}
                          Generate Preview
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {formData.use_markdown
              ? 'Markdown content will be converted to styled HTML with CAMP branding'
              : 'HTML content will be used directly'
            }
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.subject}
              className="bg-camp-green hover:bg-camp-green/90 gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {isCreating ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
