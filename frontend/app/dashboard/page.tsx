/**
 * Dashboard Page
 * Main user dashboard after login - supports multiple camper applications
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createApplication, getMyApplications, Application } from '@/lib/api-applications'
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
  LogOut,
  Settings,
  Shield,
  X,
  Mail,
  ExternalLink,
  Sparkles,
  PartyPopper,
  Users
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
              href="mailto:support@fasdcamp.org"
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="p-3 bg-camp-green/10 rounded-full text-camp-green group-hover:bg-camp-green group-hover:text-white transition-colors">
                <Mail className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-camp-charcoal">Email Us</p>
                <p className="text-sm text-gray-600">support@fasdcamp.org</p>
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

// Application Card Component
function ApplicationCard({
  application,
  onContinue,
  isAccepted
}: {
  application: Application
  onContinue: () => void
  isAccepted?: boolean
}) {
  const getStatusConfig = (status: string, percentage: number) => {
    if (status === 'accepted') {
      return {
        label: 'Accepted',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: PartyPopper,
        accentColor: 'from-emerald-500 to-green-600'
      }
    }
    if (status === 'under_review' || percentage === 100) {
      return {
        label: 'Under Review',
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
    return {
      label: 'In Progress',
      color: 'text-camp-orange',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      icon: FileText,
      accentColor: 'from-camp-orange to-amber-500'
    }
  }

  const config = getStatusConfig(application.status, application.completion_percentage)
  const StatusIcon = config.icon
  const camperName = application.camper_first_name && application.camper_last_name
    ? `${application.camper_first_name} ${application.camper_last_name}`
    : application.camper_first_name || 'New Camper'

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 ${config.borderColor} bg-white shadow-sm hover:shadow-lg transition-all duration-300 group`}>
      {/* Accent bar */}
      <div className={`h-2 bg-gradient-to-r ${config.accentColor}`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${config.bgColor}`}>
              <User className={`h-6 w-6 ${config.color}`} />
            </div>
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

        {/* Action Button */}
        <Button
          variant="primary"
          className="w-full group-hover:shadow-md transition-shadow"
          onClick={onContinue}
        >
          {application.status === 'accepted' && application.completion_percentage < 100 ? (
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

        {/* Last Updated */}
        <p className="mt-3 text-xs text-gray-400 text-center">
          Last updated: {new Date(application.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, token, logout, isAuthenticated, loading } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showFAQ, setShowFAQ] = useState(false)
  const [showContact, setShowContact] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
    // Redirect regular admins to admin dashboard (super admins can access any dashboard)
    if (!loading && user && user.role === 'admin') {
      router.push('/admin/applications')
    }
  }, [isAuthenticated, loading, user, router])

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
      alert('Failed to start application. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleContinueApplication = (applicationId: string) => {
    router.push(`/dashboard/application/${applicationId}`)
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/50 via-white to-orange-50/50">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <TreePine className="absolute top-20 left-10 h-32 w-32 text-camp-green/5 rotate-12" />
        <Sun className="absolute top-10 right-20 h-24 w-24 text-camp-orange/10" />
        <Tent className="absolute bottom-20 right-10 h-28 w-28 text-camp-green/5 -rotate-6" />
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="p-2 bg-camp-green rounded-lg group-hover:bg-camp-green/90 transition-colors">
              <TreePine className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-camp-green group-hover:text-camp-green/80 transition-colors">
                CAMP FASD
              </h1>
              <span className="text-xs text-gray-500">Application Portal</span>
            </div>
          </Link>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-camp-charcoal">
                {user.first_name || user.last_name
                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                  : user.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user.role?.replace('_', ' ')}</p>
            </div>

            {user.role === 'super_admin' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/super-admin')}
                  className="text-xs gap-1"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:inline">Super Admin</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/admin/applications')}
                  className="text-xs gap-1"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden md:inline">Admin Dashboard</span>
                </Button>
              </div>
            )}

            {user.role === 'admin' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/admin/applications')}
                className="gap-1"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden md:inline">Admin Dashboard</span>
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative container mx-auto px-4 py-8">
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-camp-green" />
              <h3 className="text-xl font-bold text-camp-charcoal">
                {applications.length > 0 ? 'Your Camper Applications' : 'Start Your First Application'}
              </h3>
            </div>
            {applications.length > 0 && (
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
                  isAccepted={app.status === 'accepted'}
                />
              ))}

              {/* Add New Camper Card */}
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
                    Start your camper application today! The process takes about 30 minutes, and you can save your progress at any time.
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
      <footer className="relative bg-camp-charcoal text-white py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <TreePine className="h-6 w-6 text-camp-green" />
              <div>
                <p className="font-semibold">CAMP FASD</p>
                <p className="text-sm text-white/60">A Community for FASD Families</p>
              </div>
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
