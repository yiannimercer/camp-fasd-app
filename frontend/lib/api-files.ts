/**
 * File upload API client
 *
 * Security: All state-changing requests include X-Requested-With header for CSRF protection.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// CSRF protection header required for state-changing requests
const CSRF_HEADER = {
  'X-Requested-With': 'XMLHttpRequest',
}

export interface FileUploadResponse {
  success: boolean
  file_id: string
  filename: string
  url: string
  message: string
}

export interface FileInfo {
  id: string
  filename: string
  size: number
  content_type: string
  url: string
  created_at: string
}

/**
 * Upload a file for an application question
 */
export async function uploadFile(
  token: string,
  file: File,
  applicationId: string,
  questionId: string
): Promise<FileUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('application_id', applicationId)
  formData.append('question_id', questionId)

  const response = await fetch(`${API_URL}/api/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'File upload failed')
  }

  return response.json()
}

/**
 * Get file information and download URL
 */
export async function getFile(token: string, fileId: string): Promise<FileInfo> {
  const response = await fetch(`${API_URL}/api/files/${fileId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get file')
  }

  return response.json()
}

/**
 * Get multiple files' information in a single batch request
 * Much faster than calling getFile() multiple times
 */
export async function getFilesBatch(token: string, fileIds: string[]): Promise<FileInfo[]> {
  if (fileIds.length === 0) {
    return []
  }

  const response = await fetch(`${API_URL}/api/files/batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER,
    },
    body: JSON.stringify(fileIds),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get files')
  }

  return response.json()
}

/**
 * Delete a file
 */
export async function deleteFile(token: string, fileId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to delete file')
  }
}

/**
 * Upload a template file (super admin only)
 */
export async function uploadTemplateFile(
  token: string,
  file: File
): Promise<FileUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_URL}/api/files/upload-template`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...CSRF_HEADER,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Template upload failed')
  }

  return response.json()
}

/**
 * Get template file information and download URL
 */
export async function getTemplateFile(token: string, fileId: string): Promise<FileInfo> {
  const response = await fetch(`${API_URL}/api/files/template/${fileId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to get template file')
  }

  return response.json()
}

