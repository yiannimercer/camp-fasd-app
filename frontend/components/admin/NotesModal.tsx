/**
 * NotesModal - Modal for viewing and adding admin notes on applications
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { X, MessageSquare, Send, Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAdminNotes, createAdminNote, AdminNote } from '@/lib/api-admin-actions'
import { formatDateCST } from '@/lib/date-utils'

interface NotesModalProps {
  isOpen: boolean
  onClose: () => void
  applicationId: string
  camperName: string
  token: string
  onNoteAdded?: () => void
}

export function NotesModal({
  isOpen,
  onClose,
  applicationId,
  camperName,
  token,
  onNoteAdded
}: NotesModalProps) {
  const [notes, setNotes] = useState<AdminNote[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const notesContainerRef = useRef<HTMLDivElement>(null)

  // Fetch notes when modal opens
  useEffect(() => {
    if (isOpen && applicationId) {
      fetchNotes()
    }
  }, [isOpen, applicationId])

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Scroll to bottom when notes change
  useEffect(() => {
    if (notesContainerRef.current) {
      notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight
    }
  }, [notes])

  const fetchNotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const fetchedNotes = await getAdminNotes(token, applicationId)
      setNotes(fetchedNotes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim() || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const createdNote = await createAdminNote(token, applicationId, { note: newNote.trim() })
      setNotes([...notes, createdNote])
      setNewNote('')
      onNoteAdded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-camp-green to-camp-green/90 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Admin Notes</h2>
                <p className="text-sm text-white/80">{camperName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div
          ref={notesContainerRef}
          className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-camp-green animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No notes yet</p>
              <p className="text-xs">Be the first to add a note!</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-camp-green/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-camp-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900">
                        {note.admin?.first_name} {note.admin?.last_name}
                      </span>
                      {note.admin?.team && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-camp-green/10 text-camp-green capitalize">
                          {note.admin.team}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap break-words">
                      {note.note}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDateCST(note.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note... (Cmd/Ctrl + Enter to send)"
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-camp-green/50 focus:border-camp-green placeholder:text-gray-400"
              rows={2}
              disabled={submitting}
            />
            <Button
              type="submit"
              disabled={!newNote.trim() || submitting}
              className="self-end px-4 py-3 bg-camp-green hover:bg-camp-green/90 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">Enter</kbd> to send
          </p>
        </form>
      </div>
    </div>
  )
}
