'use client';

/**
 * MarkdownEmailEditor - Rich markdown editor for email templates
 *
 * Features:
 * - Full markdown editing with live preview
 * - Custom toolbar for inserting template variables ({{firstName}}, etc.)
 * - Document insertion button for linking uploaded files
 * - Markdown quick reference section
 *
 * Uses @uiw/react-md-editor for the editing experience.
 * Markdown is converted to styled HTML on the backend for email sending.
 */

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  FileText,
  Variable,
  HelpCircle,
  Copy,
  Check,
  Link,
} from 'lucide-react';

// Dynamic import to avoid SSR issues with the markdown editor
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

// Available template variables for email content
const TEMPLATE_VARIABLES = [
  { key: 'firstName', label: 'First Name', description: 'Recipient first name' },
  { key: 'lastName', label: 'Last Name', description: 'Recipient last name' },
  { key: 'camperName', label: 'Camper Name', description: 'Full camper name' },
  { key: 'camperFirstName', label: 'Camper First Name', description: 'Camper first name only' },
  { key: 'camperLastName', label: 'Camper Last Name', description: 'Camper last name only' },
  { key: 'completionPercentage', label: 'Completion %', description: 'Application completion percentage' },
  { key: 'status', label: 'Status', description: 'Application status (applicant/camper)' },
  { key: 'subStatus', label: 'Sub-Status', description: 'Detailed status (in_progress, etc.)' },
  { key: 'appUrl', label: 'App URL', description: 'Link to the CAMP application' },
  { key: 'campYear', label: 'Camp Year', description: 'Current camp year' },
  { key: 'tuitionAmount', label: 'Tuition Amount', description: 'Camp fee from settings (e.g., $1,195)' },
  { key: 'remainingBalance', label: 'Remaining Balance', description: 'Outstanding balance amount' },
  { key: 'organizationName', label: 'Organization', description: 'Organization name' },
  { key: 'websiteUrl', label: 'Website URL', description: 'Main website link' },
  { key: 'paymentUrl', label: 'Payment URL', description: 'Payment page link' },
  { key: 'currentYear', label: 'Current Year', description: 'Current calendar year' },
];

// Markdown syntax quick reference
const MARKDOWN_REFERENCE = [
  { syntax: '# Heading 1', description: 'Large heading' },
  { syntax: '## Heading 2', description: 'Medium heading' },
  { syntax: '### Heading 3', description: 'Small heading' },
  { syntax: '**bold text**', description: 'Bold text' },
  { syntax: '*italic text*', description: 'Italic text' },
  { syntax: '[Link Text](url)', description: 'Hyperlink' },
  { syntax: '[Text →](url "button:orange")', description: 'CTA Button' },
  { syntax: '- Item', description: 'Bullet list' },
  { syntax: '1. Item', description: 'Numbered list' },
  { syntax: '> Quote', description: 'Block quote' },
  { syntax: '---', description: 'Horizontal line' },
];

interface EmailDocument {
  id: string;
  name: string;
  url: string;
  markdown: string;
}

interface MarkdownEmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  documents?: EmailDocument[];
  onLoadDocuments?: () => void;
  placeholder?: string;
  height?: number;
  className?: string;
}

export function MarkdownEmailEditor({
  value,
  onChange,
  documents = [],
  onLoadDocuments,
  placeholder = 'Write your email content in Markdown...',
  height = 400,
  className = '',
}: MarkdownEmailEditorProps) {
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  // Insert text at cursor or append to end
  const insertText = useCallback((text: string) => {
    // Find the textarea element
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + text + value.substring(end);
      onChange(newValue);

      // Restore cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    } else {
      // Fallback: append to end
      onChange(value + text);
    }
  }, [value, onChange]);

  // Insert a variable placeholder
  const insertVariable = useCallback((varKey: string) => {
    insertText(`{{${varKey}}}`);
    setVariablesOpen(false);
  }, [insertText]);

  // Insert a document link
  const insertDocumentLink = useCallback((doc: EmailDocument) => {
    insertText(`[${doc.name}](${doc.url})`);
    setDocsOpen(false);
  }, [insertText]);

  // Copy variable to clipboard
  const copyVariable = useCallback((varKey: string) => {
    navigator.clipboard.writeText(`{{${varKey}}}`);
    setCopiedVariable(varKey);
    setTimeout(() => setCopiedVariable(null), 2000);
  }, []);

  return (
    <div className={`markdown-email-editor ${className}`}>
      {/* Custom Toolbar */}
      <div className="flex items-center gap-2 mb-2 p-2 bg-muted/30 rounded-t-lg border border-b-0">
        {/* Variables Button */}
        <Popover open={variablesOpen} onOpenChange={setVariablesOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
            >
              <Variable className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Variables</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Template Variables</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Click to insert or copy a variable placeholder
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {TEMPLATE_VARIABLES.map((variable) => (
                <div
                  key={variable.key}
                  className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded text-sm group"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => insertVariable(variable.key)}
                  >
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-orange-600 dark:text-orange-400">
                      {`{{${variable.key}}}`}
                    </code>
                    <span className="text-muted-foreground text-xs ml-2">
                      {variable.description}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyVariable(variable.key);
                    }}
                  >
                    {copiedVariable === variable.key ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Documents Button */}
        <Popover open={docsOpen} onOpenChange={(open) => {
          setDocsOpen(open);
          if (open && onLoadDocuments) {
            onLoadDocuments();
          }
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Documents</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Insert Document Link</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Click a document to insert its markdown link
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {documents.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No documents uploaded yet.</p>
                  <p className="text-xs mt-1">
                    Go to the Documents tab to upload files.
                  </p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 py-2 px-2 hover:bg-muted/50 rounded cursor-pointer group"
                    onClick={() => insertDocumentLink(doc)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                    </div>
                    <Link className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Markdown Help */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Markdown Help</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Markdown Reference</h4>
            </div>
            <div className="p-3 space-y-2">
              {MARKDOWN_REFERENCE.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {item.syntax}
                  </code>
                  <span className="text-muted-foreground text-xs">
                    {item.description}
                  </span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Markdown Editor */}
      <div data-color-mode="light">
        <MDEditor
          value={value}
          onChange={(val) => onChange(val || '')}
          height={height}
          preview="live"
          hideToolbar={false}
          textareaProps={{
            placeholder,
          }}
        />
      </div>

      {/* Footer hint */}
      <div className="mt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Variable className="h-3 w-3" />
          Use <code className="bg-muted px-1 rounded">{`{{variableName}}`}</code> for dynamic content
        </span>
      </div>
    </div>
  );
}
