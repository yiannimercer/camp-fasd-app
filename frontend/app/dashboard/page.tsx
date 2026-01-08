/**
 * Dashboard Page
 * Main user dashboard after login - supports multiple camper applications
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useStatusColors } from '@/lib/contexts/StatusColorsContext'
import { useToast } from '@/components/shared/ToastNotification'
import { AppHeader } from '@/components/shared/AppHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createApplication, getMyApplications, reactivateApplication, withdrawApplication, Application } from '@/lib/api-applications'
import { getInvoicesForApplication, Invoice, formatCurrency, getInvoiceStatusText } from '@/lib/api-invoices'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Hand,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  HelpCircle,
  MessageCircle,
  BookOpen,
  TreePine,
  Sun,
  Tent,
  User,
  X,
  Mail,
  ExternalLink,
  Sparkles,
  PartyPopper,
  Users,
  AlertTriangle,
  UserCircle,
  Phone,
  CreditCard,
  Receipt,
  DollarSign,
  RefreshCw,
  Loader2,
  Heart,
  Calendar,
  Bell
} from 'lucide-react'

// FAQ Modal Component
function FAQModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="bg-gradient-to-r from-camp-green to-emerald-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8" />
              <div>
                <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
                <p className="text-white/80">Find answers to common questions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-semibold text-camp-charcoal mb-2">What is CAMP FASD?</h3>
              <p className="text-gray-600 text-sm">CAMP FASD is a specialized summer camp designed for children and youth affected by Fetal Alcohol Spectrum Disorder. Our trained staff provide a safe, supportive environment for campers to learn, grow, and have fun.</p>
            </div>
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-semibold text-camp-charcoal mb-2">How long does the application take?</h3>
              <p className="text-gray-600 text-sm">The full application typically takes about 30-45 minutes to complete. You can save your progress at any time and return later - your answers are automatically saved every few seconds.</p>
            </div>
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-semibold text-camp-charcoal mb-2">Can I apply for multiple children?</h3>
              <p className="text-gray-600 text-sm">Yes! You can create separate applications for each child. Simply click "Add Another Camper" on your dashboard to start a new application.</p>
            </div>
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-semibold text-camp-charcoal mb-2">What documents do I need?</h3>
              <p className="text-gray-600 text-sm">You'll need your camper's medical history, current medications list, insurance card (front and back), IEP or 504 Plan if applicable, and immunization records.</p>
            </div>
            <div className="pb-4">
              <h3 className="font-semibold text-camp-charcoal mb-2">When will I hear back about acceptance?</h3>
              <p className="text-gray-600 text-sm">Applications are reviewed by our Operations, Medical, and Behavioral Health teams. You'll receive a notification via email once all teams have reviewed your application.</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 text-center">
              Can't find what you're looking for? <button onClick={onClose} className="text-camp-green font-medium hover:underline">Contact our support team</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Applications Closed Message Component
// Displayed when applications are closed AND user has no active applications
function ApplicationsClosedMessage() {
  return (
    <div className="relative overflow-hidden">
      {/* Main Card */}
      <div className="relative bg-gradient-to-br from-white via-amber-50/30 to-orange-50/50 rounded-3xl border border-amber-200/60 shadow-xl overflow-hidden">
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-camp-orange/5 via-transparent to-camp-green/5 pointer-events-none" />

        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23316429' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative px-8 py-12 md:px-12 md:py-16">
          {/* Top decoration */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              {/* Outer glow ring */}
              <div className="absolute inset-0 bg-gradient-to-br from-camp-orange/20 to-amber-400/20 rounded-full blur-xl scale-150" />
              {/* Icon container */}
              <div className="relative p-5 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full border-2 border-amber-200/50 shadow-lg">
                <Calendar className="h-10 w-10 text-camp-orange" />
              </div>
              {/* Sparkle accents */}
              <div className="absolute -top-1 -right-1 p-1.5 bg-white rounded-full shadow-md border border-amber-100">
                <Bell className="h-4 w-4 text-amber-500" />
              </div>
            </div>
          </div>

          {/* Main heading */}
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-camp-charcoal mb-3">
              Applications Are Currently Closed
            </h2>
            <p className="text-gray-600 text-lg max-w-lg mx-auto leading-relaxed">
              Thank you for your interest in CAMP - A FASD Community! Our application is currently closed.
            </p>
          </div>

          {/* Good news box */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-200/60 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-emerald-100 rounded-xl flex-shrink-0">
                  <Heart className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-900 mb-2 text-lg">
                    Great News — You're Already on Our List!
                  </h3>
                  <p className="text-emerald-800 leading-relaxed">
                    Because you've created an account, you'll be among the <strong>first to be notified</strong> when applications open for the next camp season. We typically open applications in <strong>February</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="max-w-2xl mx-auto mb-8">
            <h4 className="text-center font-semibold text-camp-charcoal mb-4 text-lg">What to Expect</h4>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white/80 rounded-xl p-5 text-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-3 bg-blue-50 rounded-full inline-block mb-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-800">Email Notification</p>
                <p className="text-xs text-gray-500 mt-1">When applications open</p>
              </div>
              <div className="bg-white/80 rounded-xl p-5 text-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-3 bg-purple-50 rounded-full inline-block mb-3">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-800">Easy Application</p>
                <p className="text-xs text-gray-500 mt-1">Your info will be saved</p>
              </div>
              <div className="bg-white/80 rounded-xl p-5 text-center border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-3 bg-green-50 rounded-full inline-block mb-3">
                  <Sparkles className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-800">Priority Access</p>
                <p className="text-xs text-gray-500 mt-1">Early notification</p>
              </div>
            </div>
          </div>

          {/* Contact section */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-white/90 rounded-full border border-gray-200 shadow-sm">
              <span className="text-sm text-gray-600">Questions?</span>
              <a
                href="mailto:admin@fasdcamp.org"
                className="text-sm font-semibold text-camp-green hover:text-camp-green/80 transition-colors flex items-center gap-1.5"
              >
                <Mail className="h-4 w-4" />
                admin@fasdcamp.org
              </a>
            </div>
          </div>
        </div>

        {/* Bottom decorative wave */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-camp-green via-camp-orange to-camp-green opacity-40" />
      </div>
    </div>
  )
}

// Contact Support Modal Component
function ContactSupportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-camp-orange to-amber-500 p-6 text-white">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-8 w-8" />
              <div>
                <h2 className="text-2xl font-bold">Contact Support</h2>
                <p className="text-white/80">We're here to help!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <a
              href="mailto:admin@fasdcamp.org"
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="p-3 bg-camp-green/10 rounded-full text-camp-green group-hover:bg-camp-green group-hover:text-white transition-colors">
                <Mail className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-camp-charcoal">Email Us</p>
                <p className="text-sm text-gray-600">admin@fasdcamp.org</p>
              </div>
              <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-camp-green" />
            </a>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Response Time</p>
                  <p className="text-sm text-amber-700">We typically respond within 24-48 hours during business days.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 text-center">
              For urgent matters, please include "URGENT" in your email subject line.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Profile Completion Modal Component
function ProfileCompletionModal({
  isOpen,
  onClose,
  onGoToSettings,
  missingFields
}: {
  isOpen: boolean
  onClose: () => void
  onGoToSettings: () => void
  missingFields: string[]
}) {
  if (!isOpen) return null

  // Check if we have profile fields missing vs just email deliverability
  const hasProfileFields = missingFields.some(f => ['first_name', 'last_name', 'phone'].includes(f))
  const hasEmailDeliverability = missingFields.includes('email_deliverability')

  // Determine header based on what's missing
  const headerTitle = hasProfileFields && hasEmailDeliverability
    ? 'Complete Your Account Setup'
    : hasProfileFields
    ? 'Complete Your Profile'
    : 'Verify Email Deliverability'

  const headerSubtitle = hasProfileFields && hasEmailDeliverability
    ? 'A few more items to complete'
    : hasProfileFields
    ? 'Just a few more details needed'
    : 'Make sure you receive our emails'

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-camp-orange to-amber-500 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-full">
              {hasProfileFields ? (
                <UserCircle className="h-8 w-8" />
              ) : (
                <Mail className="h-8 w-8" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{headerTitle}</h2>
              <p className="text-white/80 text-sm">{headerSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            {hasProfileFields ? (
              <>Before you start your camper application, please complete your account setup. This helps us contact you about your application.</>
            ) : (
              <>Please verify that you can receive our emails. This ensures you don't miss important updates about your application.</>
            )}
          </p>

          {/* Missing Fields Checklist */}
          <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
            <p className="font-medium text-amber-800 mb-3 text-sm">
              {hasProfileFields ? 'Action items:' : 'Required:'}
            </p>
            <ul className="space-y-2">
              {missingFields.includes('first_name') && (
                <li className="flex items-center gap-2 text-sm text-amber-700">
                  <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
                    <User className="h-3 w-3 text-amber-500" />
                  </div>
                  First Name
                </li>
              )}
              {missingFields.includes('last_name') && (
                <li className="flex items-center gap-2 text-sm text-amber-700">
                  <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
                    <User className="h-3 w-3 text-amber-500" />
                  </div>
                  Last Name
                </li>
              )}
              {missingFields.includes('phone') && (
                <li className="flex items-center gap-2 text-sm text-amber-700">
                  <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
                    <Phone className="h-3 w-3 text-amber-500" />
                  </div>
                  Phone Number
                </li>
              )}
              {missingFields.includes('email_deliverability') && (
                <li className="flex items-center gap-2 text-sm text-amber-700">
                  <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
                    <Mail className="h-3 w-3 text-amber-500" />
                  </div>
                  Verify Email Deliverability
                </li>
              )}
            </ul>
          </div>

          {/* Email Deliverability Warning - only show if that's what's needed */}
          {hasEmailDeliverability && !hasProfileFields && (
            <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>Why is this important?</strong> Our emails sometimes end up in spam folders.
                Verifying ensures you receive application updates and important camp information.
              </p>
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={onGoToSettings}
            className="w-full bg-camp-green hover:bg-camp-green/90 text-white py-3"
          >
            Go to Account Settings
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {/* Dismiss hint */}
          <p className="text-xs text-gray-400 text-center mt-4">
            Click outside this box to dismiss for now
          </p>
        </div>
      </div>
    </div>
  )
}

// Application Card Component
function ApplicationCard({
  application,
  onContinue,
  onReactivate,
  onWithdraw,
  onRetryInvoices,
  isAccepted,
  isReactivating,
  isWithdrawing,
  invoices,
  isLoadingInvoices,
  invoiceLoadError
}: {
  application: Application
  onContinue: () => void
  onReactivate?: () => void
  onWithdraw?: () => void
  onRetryInvoices?: () => void
  isAccepted?: boolean
  isReactivating?: boolean
  isWithdrawing?: boolean
  invoices?: Invoice[]
  isLoadingInvoices?: boolean
  invoiceLoadError?: boolean
}) {
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false)
  const { getStatusColor, getStatusStyle } = useStatusColors()
  const isInactive = application.status === 'inactive'
  // Hide withdraw button for accepted or paid applications
  const canWithdraw = !isInactive && application.status !== 'accepted' && !(application.status === 'camper' && application.paid_invoice)

  // Get status configuration for card styling
  // Note: Uses context labels for inactive statuses, keeps family-friendly labels for active statuses
  const getStatusConfig = (status: string, subStatus: string, percentage: number) => {
    if (status === 'inactive') {
      // Use context labels for inactive statuses to stay in sync with admin configuration
      const contextLabel = getStatusColor(status, subStatus).label
      if (subStatus === 'withdrawn') {
        return {
          label: contextLabel,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          icon: AlertCircle,
          accentColor: 'from-orange-400 to-orange-500'
        }
      }
      if (subStatus === 'rejected') {
        return {
          label: contextLabel,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          icon: AlertCircle,
          accentColor: 'from-red-400 to-red-500'
        }
      }
      if (subStatus === 'deferred') {
        return {
          label: contextLabel,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-300',
          icon: Clock,
          accentColor: 'from-amber-400 to-amber-500'
        }
      }
      // Default for 'inactive' sub_status (admin deactivated)
      return {
        label: contextLabel,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        icon: AlertCircle,
        accentColor: 'from-gray-400 to-gray-500'
      }
    }
    if (status === 'accepted' || status === 'camper') {
      // Family-friendly: Show "Accepted" instead of technical sub_status
      return {
        label: 'Accepted',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: PartyPopper,
        accentColor: 'from-emerald-500 to-green-600'
      }
    }
    if (status === 'under_review' || subStatus === 'under_review' || percentage === 100) {
      // Family-friendly: Clearly show application is complete and being reviewed
      return {
        label: 'Complete - Under Review',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Clock,
        accentColor: 'from-blue-500 to-indigo-600'
      }
    }
    if (status === 'paid') {
      return {
        label: 'Paid & Confirmed',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        icon: CheckCircle2,
        accentColor: 'from-purple-500 to-violet-600'
      }
    }
    // Family-friendly: "In Progress" is clearer than "Incomplete"
    return {
      label: 'In Progress',
      color: 'text-camp-orange',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      icon: FileText,
      accentColor: 'from-camp-orange to-amber-500'
    }
  }

  const config = getStatusConfig(application.status, application.sub_status, application.completion_percentage)
  const StatusIcon = config.icon
  const camperName = application.camper_first_name && application.camper_last_name
    ? `${application.camper_first_name} ${application.camper_last_name}`
    : application.camper_first_name || 'New Camper'

  // Inactive application card with blur overlay
  if (isInactive) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-gray-300 bg-white shadow-sm">
        {/* Blurred content layer */}
        <div className="filter blur-[2px] opacity-60 pointer-events-none">
          {/* Accent bar */}
          <div className="h-2 bg-gradient-to-r from-gray-400 to-gray-500" />

          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {application.profile_photo_url ? (
                  <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white shadow-md grayscale">
                    <img
                      src={application.profile_photo_url}
                      alt={`${camperName}'s photo`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="p-3 rounded-full bg-gray-100">
                    <User className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg text-gray-500">{camperName}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-gray-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Deactivated</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Application Progress</span>
                <span className="font-bold text-gray-400">{application.completion_percentage}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-400"
                  style={{ width: `${application.completion_percentage}%` }}
                />
              </div>
            </div>

            {/* Placeholder button */}
            <div className="w-full h-10 bg-gray-200 rounded-lg"></div>
          </div>
        </div>

        {/* Overlay with Activate button */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px]">
          <div className="text-center p-6">
            <div className={`p-3 ${config.bgColor} rounded-full inline-block mb-3`}>
              <StatusIcon className={`h-8 w-8 ${config.color}`} />
            </div>
            <h4 className="font-bold text-gray-700 mb-1">
              Application {config.label}
            </h4>
            <p className="text-sm text-gray-500 mb-4 max-w-[200px]">
              {application.sub_status === 'withdrawn'
                ? 'You withdrew this application. Click below to reactivate it.'
                : application.sub_status === 'rejected'
                ? 'This application was not accepted. You may reactivate to apply again.'
                : application.sub_status === 'deferred'
                ? 'This application has been deferred. Click below to reactivate it.'
                : 'This application has been deactivated. Click below to reactivate it.'}
            </p>
            <Button
              variant="primary"
              onClick={onReactivate}
              disabled={isReactivating}
              className="gap-2"
            >
              {isReactivating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Activating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Activate Application
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 ${config.borderColor} bg-white shadow-sm hover:shadow-lg transition-all duration-300 group`}>
      {/* Accent bar */}
      <div className={`h-2 bg-gradient-to-r ${config.accentColor}`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Profile Photo or Default Icon */}
            {application.profile_photo_url ? (
              <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white shadow-md">
                <img
                  src={application.profile_photo_url}
                  alt={`${camperName}'s photo`}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className={`p-3 rounded-full ${config.bgColor}`}>
                <User className={`h-6 w-6 ${config.color}`} />
              </div>
            )}
            <div>
              <h3 className="font-bold text-lg text-camp-charcoal">{camperName}</h3>
              <div className={`flex items-center gap-1.5 text-sm ${config.color}`}>
                <StatusIcon className="h-4 w-4" />
                <span className="font-medium">{config.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Application Progress</span>
            <span className="font-bold text-camp-charcoal">{application.completion_percentage}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${config.accentColor} transition-all duration-500`}
              style={{ width: `${application.completion_percentage}%` }}
            />
          </div>
        </div>

        {/* Acceptance Banner */}
        {isAccepted && application.completion_percentage < 100 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">
                Complete remaining sections to finalize registration!
              </p>
            </div>
          </div>
        )}

        {/* Payment Section - Only for camper status */}
        {application.status === 'camper' && (
          <div className="mb-4">
            {/* State 1: Loading invoices */}
            {isLoadingInvoices ? (
              <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse mb-1"></div>
                    <div className="h-3 bg-gray-100 rounded w-24 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ) : invoiceLoadError ? (
              /* State 2: Error loading invoices - Show retry button */
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 rounded-full">
                      <CreditCard className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Payment Required
                      </p>
                      <p className="text-xs text-amber-600">
                        Couldn't load invoice details
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onRetryInvoices}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm hover:shadow-md"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Loading Invoice
                </button>
              </div>
            ) : invoices && invoices.length > 0 ? (
              /* State 3: Invoices loaded successfully */
              (() => {
                const openInvoices = invoices.filter(inv => inv.status === 'open')
                const paidInvoices = invoices.filter(inv => inv.status === 'paid')
                const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0)
                const outstandingAmount = openInvoices.reduce((sum, inv) => sum + inv.amount, 0)
                const allPaid = openInvoices.length === 0 && paidInvoices.length > 0

                if (allPaid) {
                  /* State 3a: All invoices paid */
                  return (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-full">
                          <CheckCircle2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-purple-800">
                            Payment Complete!
                          </p>
                          <p className="text-xs text-purple-600">
                            Total paid: {formatCurrency(totalPaid)}
                          </p>
                        </div>
                        <Receipt className="h-6 w-6 text-purple-400" />
                      </div>
                    </div>
                  )
                }

                /* State 3b: Has unpaid invoices */
                const nextInvoice = openInvoices[0]
                const hasInvoiceUrl = nextInvoice?.stripe_invoice_url

                return (
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 rounded-full">
                          <CreditCard className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-amber-800">
                            Payment Required
                          </p>
                          <p className="text-xs text-amber-600">
                            {openInvoices.length > 1
                              ? `${openInvoices.length} payments remaining`
                              : 'Balance due'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-amber-800">
                          {formatCurrency(outstandingAmount)}
                        </p>
                        {paidInvoices.length > 0 && (
                          <p className="text-xs text-amber-600">
                            {formatCurrency(totalPaid)} paid
                          </p>
                        )}
                      </div>
                    </div>

                    {hasInvoiceUrl ? (
                      /* Has Stripe URL - Show Pay Now button */
                      <a
                        href={nextInvoice.stripe_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-camp-green to-emerald-600 text-white text-sm font-semibold rounded-lg hover:from-camp-green/90 hover:to-emerald-600/90 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                      >
                        <DollarSign className="h-4 w-4" />
                        Pay Now
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      /* Invoice exists but no URL yet - Show refresh button */
                      <button
                        onClick={onRetryInvoices}
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm hover:shadow-md"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh Invoice
                      </button>
                    )}

                    {nextInvoice?.due_date && (
                      <p className="text-xs text-amber-600 text-center mt-2 flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due: {new Date(nextInvoice.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                )
              })()
            ) : application.paid_invoice === true ? (
              /* State 4: Paid (from application field, no invoice data) */
              <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-purple-800">
                      Payment Complete!
                    </p>
                    <p className="text-xs text-purple-600">
                      Registration confirmed
                    </p>
                  </div>
                  <Receipt className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            ) : application.paid_invoice === false ? (
              /* State 5: Payment required but no invoices loaded yet (no error, just no data)
                 This could mean invoice wasn't created yet - provide an action button */
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 rounded-full">
                      <CreditCard className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        Payment Required
                      </p>
                      <p className="text-xs text-amber-600">
                        Invoice being prepared
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onRetryInvoices}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm hover:shadow-md"
                >
                  <RefreshCw className="h-4 w-4" />
                  Load Invoice
                </button>
                <p className="text-xs text-amber-600/80 text-center mt-2">
                  Click to check if your invoice is ready
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Action Button */}
        <Button
          variant="primary"
          className="w-full group-hover:shadow-md transition-shadow"
          onClick={onContinue}
        >
          {(application.status === 'accepted' || application.status === 'camper') && application.completion_percentage < 100 ? (
            <>
              Complete Registration
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : application.completion_percentage === 100 ? (
            <>
              View Application
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Continue Application
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {/* Withdraw Button */}
        {canWithdraw && onWithdraw && (
          <Button
            variant="ghost"
            className="w-full mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
            onClick={() => setShowWithdrawDialog(true)}
            disabled={isWithdrawing}
          >
            {isWithdrawing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                Withdrawing...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Withdraw Application
              </>
            )}
          </Button>
        )}

        {/* Last Updated */}
        <p className="mt-3 text-xs text-gray-400 text-center">
          Last updated: {new Date(application.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </p>
      </div>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <DialogTitle>Withdraw Application?</DialogTitle>
                <DialogDescription className="mt-1">
                  Are you sure you want to withdraw this application?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              This will withdraw <span className="font-semibold">{application.camper_first_name || 'this camper'}'s</span> application from consideration for CAMP.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              You might not be able to reactivate the application later and if this is the case, you will need to start a new one if you change your mind.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setShowWithdrawDialog(false)
                onWithdraw?.()
              }}
            >
              Yes, Withdraw Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, loading } = useAuth()
  const toast = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [creating, setCreating] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [showFAQ, setShowFAQ] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [invoicesByApp, setInvoicesByApp] = useState<Record<string, Invoice[]>>({})
  const [loadingInvoices, setLoadingInvoices] = useState<Record<string, boolean>>({})
  const [invoiceLoadErrors, setInvoiceLoadErrors] = useState<Record<string, boolean>>({})
  const [applicationsOpen, setApplicationsOpen] = useState<boolean>(true) // Default to open until we fetch

  // Calculate missing profile fields and account requirements
  const getMissingAccountItems = (): string[] => {
    if (!user) return []
    const missing: string[] = []
    if (!user.first_name?.trim()) missing.push('first_name')
    if (!user.last_name?.trim()) missing.push('last_name')
    if (!user.phone?.trim()) missing.push('phone')
    // Email deliverability verification - ensures user receives our emails
    if (!user.email_deliverability_confirmed) missing.push('email_deliverability')
    return missing
  }

  const missingProfileFields = getMissingAccountItems()
  const isProfileIncomplete = missingProfileFields.length > 0

  // Show profile modal on mount if profile is incomplete (only for regular users, not admins)
  useEffect(() => {
    if (!loading && user && user.role === 'user' && isProfileIncomplete) {
      setShowProfileModal(true)
    }
  }, [loading, user, isProfileIncomplete])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
    // Redirect regular admins to admin dashboard (super admins can access any dashboard)
    if (!loading && user && user.role === 'admin') {
      router.push('/admin/applications')
    }
  }, [isAuthenticated, loading, user, router])

  // Fetch whether applications are open (public config, no auth needed)
  useEffect(() => {
    const fetchApplicationsStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/public/config/allow_new_applications`)
        if (response.ok) {
          const data = await response.json()
          // Value is stored as string 'true' or 'false' in the database
          setApplicationsOpen(data.value === true || data.value === 'true')
        }
      } catch (error) {
        console.error('Failed to fetch applications status:', error)
        // Default to open if we can't fetch the config
        setApplicationsOpen(true)
      }
    }

    fetchApplicationsStatus()
  }, [])

  // Load user's applications
  useEffect(() => {
    if (!token || !isAuthenticated) return

    const loadApplications = async () => {
      try {
        const apps = await getMyApplications(token)
        setApplications(apps)
      } catch (error) {
        console.error('Failed to load applications:', error)
      } finally {
        setLoadingApps(false)
      }
    }

    loadApplications()
  }, [token, isAuthenticated])

  // Load invoices for a single application (used for initial load and retry)
  const loadInvoicesForApp = async (appId: string) => {
    if (!token) return

    setLoadingInvoices(prev => ({ ...prev, [appId]: true }))
    setInvoiceLoadErrors(prev => ({ ...prev, [appId]: false }))

    try {
      const invoices = await getInvoicesForApplication(token, appId)
      setInvoicesByApp(prev => ({ ...prev, [appId]: invoices }))
      setInvoiceLoadErrors(prev => ({ ...prev, [appId]: false }))
    } catch (error) {
      console.error(`Failed to load invoices for application ${appId}:`, error)
      setInvoiceLoadErrors(prev => ({ ...prev, [appId]: true }))
    } finally {
      setLoadingInvoices(prev => ({ ...prev, [appId]: false }))
    }
  }

  // Load invoices for camper applications on initial load
  useEffect(() => {
    if (!token || !applications.length) return

    const camperApps = applications.filter(app => app.status === 'camper')
    if (camperApps.length === 0) return

    // Fetch invoices for each camper app in parallel
    camperApps.forEach(app => {
      loadInvoicesForApp(app.id)
    })
  }, [token, applications])

  const handleStartApplication = async () => {
    if (!token) return

    setCreating(true)
    try {
      // Create new application (no longer checking for existing)
      const newApp = await createApplication(token, {
        camper_first_name: '',
        camper_last_name: ''
      })

      // Redirect to application wizard
      router.push(`/dashboard/application/${newApp.id}`)
    } catch (error) {
      console.error('Failed to create application:', error)
      toast.error('Failed to start application. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleContinueApplication = (applicationId: string) => {
    router.push(`/dashboard/application/${applicationId}`)
  }

  const handleReactivateApplication = async (applicationId: string) => {
    if (!token) return

    setReactivatingId(applicationId)
    try {
      const reactivated = await reactivateApplication(token, applicationId)
      // Refresh the applications list
      const apps = await getMyApplications(token)
      setApplications(apps)
      // Navigate to the reactivated application
      router.push(`/dashboard/application/${applicationId}`)
    } catch (error) {
      console.error('Failed to reactivate application:', error)
      toast.error('Failed to reactivate application. Please try again.')
    } finally {
      setReactivatingId(null)
    }
  }

  const handleWithdrawApplication = async (applicationId: string) => {
    if (!token) return

    setWithdrawingId(applicationId)
    try {
      await withdrawApplication(token, applicationId)
      // Refresh the applications list
      const apps = await getMyApplications(token)
      setApplications(apps)
      toast.success('Application withdrawn successfully')
    } catch (error) {
      console.error('Failed to withdraw application:', error)
      toast.error('Failed to withdraw application. Please try again.')
    } finally {
      setWithdrawingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-orange-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-camp-green mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const hasAcceptedApplication = applications.some(app => app.status === 'accepted')

  // Determine if user has any active applications (applicant or camper status)
  // These users should still see their application cards even when new applications are closed
  const hasActiveApplications = applications.some(
    app => app.status === 'applicant' || app.status === 'camper'
  )

  // Show closed message when:
  // 1. Applications are closed (allow_new_applications = false)
  // 2. AND user has NO applications OR all their applications are inactive
  const shouldShowClosedMessage = !applicationsOpen && !hasActiveApplications

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50/50 via-white to-orange-50/50">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <TreePine className="absolute top-20 left-10 h-32 w-32 text-camp-green/5 rotate-12" />
        <Sun className="absolute top-10 right-20 h-24 w-24 text-camp-orange/10" />
        <Tent className="absolute bottom-20 right-10 h-28 w-28 text-camp-green/5 -rotate-6" />
      </div>

      {/* Header */}
      <AppHeader currentView="user" />

      {/* Main Content */}
      <main className="relative flex-1 container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold text-camp-charcoal">
              Welcome back, {user.first_name || 'Friend'}!
            </h2>
            <Hand className="h-8 w-8 text-camp-orange animate-wave" />
          </div>
          <p className="text-gray-600">
            Manage your camper applications and track your progress toward an amazing summer experience.
          </p>
        </div>

        {/* Acceptance Celebration Banner */}
        {hasAcceptedApplication && (
          <div className="mb-8 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-full">
                <PartyPopper className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">
                  Congratulations! You have an accepted application!
                </h3>
                <p className="text-white/90">
                  We're thrilled to welcome your camper to CAMP FASD! Please complete any remaining registration sections below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Applications Section */}
        <div className="mb-8">
          {shouldShowClosedMessage ? (
            /* Show closed message when applications are closed and user has no active applications */
            <ApplicationsClosedMessage />
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-camp-green" />
                  <h3 className="text-xl font-bold text-camp-charcoal">
                    {applications.length > 0 ? 'Your Camper Applications' : 'Start Your First Application'}
                  </h3>
                </div>
                {/* Only show Add Another Camper button when applications are open */}
                {applications.length > 0 && applicationsOpen && (
                  <Button
                    variant="outline"
                    onClick={handleStartApplication}
                    disabled={creating}
                    className="gap-2 border-camp-green text-camp-green hover:bg-camp-green hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Add Another Camper
                  </Button>
                )}
              </div>

              {loadingApps ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-64 bg-gray-200 rounded-2xl"></div>
                </div>
              ))}
            </div>
          ) : applications.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {applications.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onContinue={() => handleContinueApplication(app.id)}
                  onReactivate={() => handleReactivateApplication(app.id)}
                  onWithdraw={() => handleWithdrawApplication(app.id)}
                  onRetryInvoices={() => loadInvoicesForApp(app.id)}
                  isAccepted={app.status === 'accepted' || app.status === 'camper'}
                  isReactivating={reactivatingId === app.id}
                  isWithdrawing={withdrawingId === app.id}
                  invoices={invoicesByApp[app.id]}
                  isLoadingInvoices={loadingInvoices[app.id]}
                  invoiceLoadError={invoiceLoadErrors[app.id]}
                />
              ))}

              {/* Add New Camper Card - only show when applications are open */}
              {applicationsOpen && (
                <button
                  onClick={handleStartApplication}
                  disabled={creating}
                  className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-white/50 hover:bg-white hover:border-camp-green hover:shadow-lg transition-all duration-300 group min-h-[280px] flex flex-col items-center justify-center p-6"
                >
                  <div className="p-4 bg-gray-100 group-hover:bg-camp-green/10 rounded-full mb-4 transition-colors">
                    <Plus className="h-8 w-8 text-gray-400 group-hover:text-camp-green transition-colors" />
                  </div>
                  <p className="font-semibold text-gray-600 group-hover:text-camp-green transition-colors">
                    {creating ? 'Creating...' : 'Add Another Camper'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Start a new application
                  </p>
                </button>
              )}
            </div>
          ) : (
            /* Empty State - First Time User */
            <Card className="border-2 border-dashed border-gray-300 bg-white/50">
              <CardContent className="py-12">
                <div className="text-center max-w-md mx-auto">
                  <div className="p-4 bg-camp-green/10 rounded-full inline-block mb-4">
                    <Tent className="h-12 w-12 text-camp-green" />
                  </div>
                  <h3 className="text-xl font-bold text-camp-charcoal mb-2">
                    Ready to Begin Your Camp Adventure?
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Start your camper application today! The process takes can take an hour or two, but you can save your progress and return to complete the application at any time.
                  </p>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      What You'll Need
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        Camper's medical history and current medications
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        Insurance card (front and back)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        IEP or 504 Plan (if applicable)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        Immunization records
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        Emergency contact information
                      </li>
                    </ul>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleStartApplication}
                    disabled={creating}
                    className="gap-2"
                  >
                    {creating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        Start New Application
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
            </>
          )}
        </div>

        {/* Help Section */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-camp-green/10 rounded-lg">
              <HelpCircle className="h-6 w-6 text-camp-green" />
            </div>
            <div>
              <h3 className="font-bold text-camp-charcoal">Need Help?</h3>
              <p className="text-sm text-gray-600">We're here to assist you every step of the way.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContact(true)}
              className="gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Contact Support
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFAQ(true)}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              View FAQ
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative bg-camp-charcoal text-white py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <TreePine className="h-6 w-6 text-camp-green" />
              <div>
                <p className="font-semibold">CAMP FASD</p>
                <p className="text-sm text-white/60">A Community for FASD Families</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/60">
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            </div>
            <p className="text-white/60 text-sm">
              © {new Date().getFullYear()} CAMP FASD. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <FAQModal isOpen={showFAQ} onClose={() => setShowFAQ(false)} />
      <ContactSupportModal isOpen={showContact} onClose={() => setShowContact(false)} />
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onGoToSettings={() => {
          setShowProfileModal(false)
          router.push('/settings')
        }}
        missingFields={missingProfileFields}
      />

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(20deg); }
          75% { transform: rotate(-10deg); }
        }
        .animate-wave {
          animation: wave 1.5s ease-in-out infinite;
          transform-origin: 70% 70%;
        }
      `}</style>
    </div>
  )
}
