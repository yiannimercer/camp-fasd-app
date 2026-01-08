'use client';

/**
 * DocumentsTab - Document management for email templates
 *
 * Features:
 * - Drag & drop file upload using react-dropzone
 * - List all uploaded documents with metadata
 * - Copy markdown link to clipboard for easy insertion
 * - Delete documents
 *
 * Documents are stored in Supabase Storage and can be linked
 * in email content using markdown syntax: [Name](url)
 */

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileText,
  Upload,
  Trash2,
  Copy,
  Check,
  Link,
  FileImage,
  FileSpreadsheet,
  File,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmationModal } from '@/components/shared/ConfirmationModal';

// File type icons
const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return FileSpreadsheet;
  if (fileType.includes('pdf')) return FileText;
  return File;
};

// Format file size for display
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format date for display
const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export interface EmailDocument {
  id: string;
  name: string;
  description?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  url?: string;
  created_at: string;
  uploaded_by_name?: string;
}

interface DocumentsTabProps {
  documents: EmailDocument[];
  isLoading: boolean;
  onUpload: (file: File, name: string, description?: string) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onRefresh: () => void;
}

export function DocumentsTab({
  documents,
  isLoading,
  onUpload,
  onDelete,
  onRefresh,
}: DocumentsTabProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [documentToDelete, setDocumentToDelete] = useState<EmailDocument | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      // Auto-fill name from filename (without extension)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setDocumentName(nameWithoutExt);
      setDocumentDescription('');
      setUploadError(null);
      setUploadDialogOpen(true);
    }
  }, []);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  // Handle upload submission
  const handleUpload = async () => {
    if (!selectedFile || !documentName.trim()) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      await onUpload(selectedFile, documentName.trim(), documentDescription.trim() || undefined);
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setDocumentName('');
      setDocumentDescription('');
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(documentToDelete.id);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy markdown link to clipboard
  const copyMarkdownLink = (doc: EmailDocument) => {
    if (doc.url) {
      navigator.clipboard.writeText(`[${doc.name}](${doc.url})`);
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Documents</h3>
          <p className="text-sm text-muted-foreground">
            Upload documents to link in your email templates
          </p>
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragActive ? 'text-green-600' : 'text-muted-foreground'}`} />
        <p className="text-sm font-medium">
          {isDragActive ? 'Drop the file here...' : 'Drag & drop a file, or click to select'}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          PDF, Images, Word, Excel, or Text files up to 10MB
        </p>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm mt-1">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {documents.map((doc) => {
            const IconComponent = getFileIcon(doc.file_type);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                {/* File Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <IconComponent className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{doc.file_name}</span>
                    <span>•</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    {doc.uploaded_by_name && (
                      <>
                        <span>•</span>
                        <span>by {doc.uploaded_by_name}</span>
                      </>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {doc.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => copyMarkdownLink(doc)}
                    >
                      {copiedId === doc.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-500" />
                          <span className="hidden sm:inline">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Link className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Copy Link</span>
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setDocumentToDelete(doc);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Give your document a name and optional description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected File Info */}
            {selectedFile && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadDialogOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Document Name */}
            <div className="space-y-2">
              <Label htmlFor="doc-name">Display Name *</Label>
              <Input
                id="doc-name"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="e.g., Medical Release Form"
              />
              <p className="text-xs text-muted-foreground">
                This name will appear in email links
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="doc-description">Description (optional)</Label>
              <Textarea
                id="doc-description"
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                placeholder="Brief description of this document..."
                rows={2}
              />
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !documentName.trim() || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteDialogOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteDialogOpen(false);
            setDocumentToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        title="Delete Document"
        message={
          <>
            Are you sure you want to delete <strong>"{documentToDelete?.name}"</strong>?
            This action cannot be undone. Any email templates linking to this
            document will have broken links.
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        theme="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
