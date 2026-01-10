/**
 * ConfirmationModal - Reusable styled confirmation dialog
 *
 * Replaces browser confirm() dialogs with a consistent,
 * branded modal following the payment modal design system.
 *
 * Themes:
 * - danger: Red gradient, destructive actions (delete, void)
 * - warning: Amber gradient, cautionary actions (withdraw, deactivate)
 * - info: Blue gradient, informational confirmations
 * - success: Green gradient, positive actions (accept, promote)
 * - purple: Purple gradient, special actions (waitlist)
 */

'use client'

import { ReactNode } from 'react'
import {
  AlertTriangle,
  Trash2,
  CheckCircle,
  Info,
  X,
  Loader2,
  Star,
  Clock
} from 'lucide-react'

export type ConfirmationTheme = 'danger' | 'warning' | 'info' | 'success' | 'purple'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  theme?: ConfirmationTheme
  icon?: ReactNode
  isLoading?: boolean
  /** Optional additional content between message and buttons */
  children?: ReactNode
}

const themeConfig: Record<ConfirmationTheme, {
  gradient: string
  buttonBg: string
  buttonHover: string
  iconBg: string
  defaultIcon: ReactNode
}> = {
  danger: {
    gradient: 'from-red-600 to-rose-600',
    buttonBg: 'bg-red-600',
    buttonHover: 'hover:bg-red-700',
    iconBg: 'bg-white/20',
    defaultIcon: <Trash2 className="h-5 w-5 text-white" />
  },
  warning: {
    gradient: 'from-amber-500 to-orange-500',
    buttonBg: 'bg-amber-600',
    buttonHover: 'hover:bg-amber-700',
    iconBg: 'bg-white/20',
    defaultIcon: <AlertTriangle className="h-5 w-5 text-white" />
  },
  info: {
    gradient: 'from-blue-600 to-indigo-600',
    buttonBg: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-700',
    iconBg: 'bg-white/20',
    defaultIcon: <Info className="h-5 w-5 text-white" />
  },
  success: {
    gradient: 'from-green-600 to-emerald-600',
    buttonBg: 'bg-green-600',
    buttonHover: 'hover:bg-green-700',
    iconBg: 'bg-white/20',
    defaultIcon: <Star className="h-5 w-5 text-white" />
  },
  purple: {
    gradient: 'from-purple-600 to-violet-600',
    buttonBg: 'bg-purple-600',
    buttonHover: 'hover:bg-purple-700',
    iconBg: 'bg-white/20',
    defaultIcon: <Clock className="h-5 w-5 text-white" />
  }
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  theme = 'info',
  icon,
  isLoading = false,
  children
}: ConfirmationModalProps) {
  if (!isOpen) return null

  const config = themeConfig[theme]
  const displayIcon = icon || config.defaultIcon

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${config.gradient} px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${config.iconBg} rounded-lg`}>
                {displayIcon}
              </div>
              <h3 id="confirm-modal-title" className="text-lg font-bold text-white">
                {title}
              </h3>
            </div>
            {!isLoading && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-gray-700 text-sm leading-relaxed mb-6">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>

          {children}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-3 ${config.buttonBg} text-white rounded-xl ${config.buttonHover} font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
