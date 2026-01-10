/**
 * ApplicationActionStrip Component
 *
 * A unified, elegant action interface for the admin applications table.
 * Replaces the cluttered buttons + dropdown with a cohesive "command strip" design.
 *
 * Design Philosophy:
 * - Primary action (Review/View) is always prominent
 * - Quick icons for frequent actions (Notes, Email)
 * - Expandable panel for status-changing actions (rendered via portal)
 * - Status-aware: shows only relevant actions
 * - Scalable: easy to add new actions without redesign
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ApplicationWithUser } from '@/lib/api-admin'
import {
  Eye,
  ClipboardList,
  MessageSquare,
  Mail,
  ChevronDown,
  CheckCircle2,
  Clock,
  ArrowRightCircle,
  XCircle,
  CalendarX,
  Sparkles,
  ThumbsUp
} from 'lucide-react'

interface ApplicationActionStripProps {
  app: ApplicationWithUser
  userRole: string | undefined
  onOpenNotes: (app: ApplicationWithUser) => void
  onOpenEmail: (app: ApplicationWithUser) => void
  onPromote: (app: ApplicationWithUser) => void
  onApprove: (appId: string) => void
  onWaitlist: (app: ApplicationWithUser) => void
  onRemoveWaitlist: (app: ApplicationWithUser, action: 'promote' | 'return_review') => void
  onDeactivate: (app: ApplicationWithUser) => void
  onDefer: (app: ApplicationWithUser) => void
}

export function ApplicationActionStrip({
  app,
  userRole,
  onOpenNotes,
  onOpenEmail,
  onPromote,
  onApprove,
  onWaitlist,
  onRemoveWaitlist,
  onDeactivate,
  onDefer
}: ApplicationActionStripProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 })

  // Calculate panel position when expanded
  useEffect(() => {
    if (isExpanded && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPanelPosition({
        top: rect.bottom + 8,
        left: rect.right - 280 // Panel width ~280px, align right edge
      })
    }
  }, [isExpanded])

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsExpanded(false)
      }
    }
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }
    if (isExpanded) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isExpanded])

  // Determine primary action label and icon
  const isPrimaryReview = app.status === 'applicant'
  const primaryLabel = isPrimaryReview ? 'Review' : 'View'
  const PrimaryIcon = isPrimaryReview ? ClipboardList : Eye

  // Determine if this is a terminal state (no more actions available)
  const isTerminal = app.status === 'inactive' || (app.status === 'camper' && app.paid_invoice === true)

  // Build status actions with actual handlers
  const statusActions = buildStatusActions(app, userRole, {
    onPromote,
    onApprove,
    onWaitlist,
    onRemoveWaitlist,
    onDefer
  })

  // Check if there's a "power action" (Accept) available - should be highlighted
  const hasPowerAction = statusActions.some(a => a.type === 'accept' || a.type === 'accept_waitlist')

  // Portal panel content
  const panelContent = isExpanded && !isTerminal && (
    <div
      ref={panelRef}
      className="fixed min-w-[280px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{
        top: panelPosition.top,
        left: Math.max(16, panelPosition.left), // Don't go off-screen left
        zIndex: 9999,
        animation: 'actionPanelIn 0.15s ease-out forwards'
      }}
    >
      {/* Panel Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Quick Actions
        </div>
      </div>

      {/* Action Groups */}
      <div className="p-2 max-h-[400px] overflow-y-auto">
        {/* Status Actions */}
        {statusActions.length > 0 && (
          <div className="space-y-1">
            {statusActions.map((action, idx) => (
              <ActionButton
                key={idx}
                icon={action.icon}
                label={action.label}
                description={action.description}
                variant={action.variant}
                onClick={() => {
                  action.onClick()
                  setIsExpanded(false)
                }}
              />
            ))}
          </div>
        )}

        {/* Divider */}
        {statusActions.length > 0 && (
          <div className="my-2 border-t border-gray-100" />
        )}

        {/* Communication */}
        <ActionButton
          icon={Mail}
          label="Email Family"
          description="Send a direct email"
          variant="default"
          onClick={() => {
            onOpenEmail(app)
            setIsExpanded(false)
          }}
        />

        {/* Danger Zone */}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <ActionButton
            icon={XCircle}
            label="Deactivate"
            description="Remove from active list"
            variant="danger"
            onClick={() => {
              onDeactivate(app)
              setIsExpanded(false)
            }}
          />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Main Action Strip */}
      <div className="flex items-center gap-1">
        {/* Primary Action Button - Review/View */}
        <button
          onClick={() => router.push(`/admin/applications/${app.id}`)}
          className={`
            group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
            transition-all duration-200 ease-out
            ${isPrimaryReview
              ? 'bg-camp-green/10 text-camp-green hover:bg-camp-green hover:text-white border border-camp-green/30 hover:border-camp-green'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <PrimaryIcon className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          {primaryLabel}
        </button>

        {/* Quick Action Icons */}
        <div className="flex items-center">
          {/* Notes - always available */}
          <button
            onClick={() => onOpenNotes(app)}
            className="relative p-2 rounded-lg hover:bg-amber-50 transition-all duration-200 group"
            title={`${app.note_count || 0} notes`}
          >
            <MessageSquare className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
            {(app.note_count || 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-bold text-white bg-amber-500 rounded-full px-1 shadow-sm">
                {app.note_count}
              </span>
            )}
          </button>

          {/* Email - always available */}
          <button
            onClick={() => onOpenEmail(app)}
            className="p-2 rounded-lg hover:bg-blue-50 transition-all duration-200 group"
            title="Email family"
          >
            <Mail className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </button>
        </div>

        {/* More Actions Trigger (only if not terminal) */}
        {!isTerminal && (
          <button
            ref={triggerRef}
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
              flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium
              transition-all duration-200 ease-out
              ${isExpanded
                ? 'bg-gray-200 text-gray-800'
                : hasPowerAction
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              }
            `}
            title="More actions"
          >
            {hasPowerAction && <Sparkles className="w-3 h-3" />}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Portal the panel to body so it's not constrained by table z-index */}
      {typeof window !== 'undefined' && createPortal(
        <>
          {panelContent}
          {/* Global styles for animation */}
          <style>{`
            @keyframes actionPanelIn {
              from {
                opacity: 0;
                transform: translateY(-8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </>,
        document.body
      )}
    </>
  )
}

// Helper component for action buttons in the panel
interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info'
  onClick: () => void
}

function ActionButton({ icon: Icon, label, description, variant, onClick }: ActionButtonProps) {
  const variantStyles = {
    default: 'hover:bg-gray-50 text-gray-700',
    success: 'hover:bg-emerald-50 text-emerald-700',
    warning: 'hover:bg-amber-50 text-amber-700',
    danger: 'hover:bg-red-50 text-red-600',
    info: 'hover:bg-blue-50 text-blue-700',
  }

  const iconBgStyles = {
    default: 'bg-gray-100 group-hover:bg-gray-200',
    success: 'bg-emerald-100 group-hover:bg-emerald-200',
    warning: 'bg-amber-100 group-hover:bg-amber-200',
    danger: 'bg-red-100 group-hover:bg-red-200',
    info: 'bg-blue-100 group-hover:bg-blue-200',
  }

  const iconStyles = {
    default: 'text-gray-500',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-500',
    info: 'text-blue-600',
  }

  return (
    <button
      onClick={onClick}
      className={`
        group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        transition-all duration-150 text-left
        ${variantStyles[variant]}
      `}
    >
      <div className={`p-1.5 rounded-md transition-colors ${iconBgStyles[variant]}`}>
        <Icon className={`w-4 h-4 ${iconStyles[variant]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-500 truncate">{description}</div>
      </div>
    </button>
  )
}

// Build status actions with actual handlers connected
interface StatusAction {
  type: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info'
  onClick: () => void
}

function buildStatusActions(
  app: ApplicationWithUser,
  userRole: string | undefined,
  handlers: {
    onPromote: (app: ApplicationWithUser) => void
    onApprove: (appId: string) => void
    onWaitlist: (app: ApplicationWithUser) => void
    onRemoveWaitlist: (app: ApplicationWithUser, action: 'promote' | 'return_review') => void
    onDefer: (app: ApplicationWithUser) => void
  }
): StatusAction[] {
  const actions: StatusAction[] = []

  // Applicant status actions
  if (app.status === 'applicant') {
    // Complete or Under Review - can be accepted/waitlisted
    if (['complete', 'under_review'].includes(app.sub_status)) {
      // Super admins can always accept
      if (userRole === 'super_admin') {
        actions.push({
          type: 'accept',
          icon: CheckCircle2,
          label: 'Accept as Camper',
          description: 'Promote to camper status',
          variant: 'success',
          onClick: () => handlers.onPromote(app)
        })
      }
      // Regular admins - depends on approval count
      else if ((app.approval_count || 0) >= 3) {
        actions.push({
          type: 'accept',
          icon: CheckCircle2,
          label: 'Accept as Camper',
          description: '3/3 approvals reached',
          variant: 'success',
          onClick: () => handlers.onPromote(app)
        })
      } else {
        actions.push({
          type: 'approve',
          icon: ThumbsUp,
          label: `Approve (${app.approval_count || 0}/3)`,
          description: 'Add your approval vote',
          variant: 'info',
          onClick: () => handlers.onApprove(app.id)
        })
      }

      // Add to waitlist option
      actions.push({
        type: 'waitlist',
        icon: Clock,
        label: 'Add to Waitlist',
        description: 'Pending staffing availability',
        variant: 'warning',
        onClick: () => handlers.onWaitlist(app)
      })

      // Defer option (if declines exist)
      if ((app.decline_count || 0) >= 1) {
        actions.push({
          type: 'defer',
          icon: CalendarX,
          label: 'Defer to Next Year',
          description: `${app.decline_count} decline${(app.decline_count || 0) > 1 ? 's' : ''} received`,
          variant: 'warning',
          onClick: () => handlers.onDefer(app)
        })
      }
    }

    // On waitlist - can accept or return to review
    if (app.sub_status === 'waitlist') {
      actions.push({
        type: 'accept_waitlist',
        icon: CheckCircle2,
        label: 'Accept from Waitlist',
        description: 'Promote to camper status',
        variant: 'success',
        onClick: () => handlers.onRemoveWaitlist(app, 'promote')
      })
      actions.push({
        type: 'return_review',
        icon: ArrowRightCircle,
        label: 'Return to Review',
        description: 'Move back to under review',
        variant: 'info',
        onClick: () => handlers.onRemoveWaitlist(app, 'return_review')
      })
    }
  }

  return actions
}
