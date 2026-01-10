/**
 * Account Settings Page
 * Allows users to manage their profile, password, and preferences
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppHeader } from '@/components/shared/AppHeader'
import { User, Lock, CheckCircle, AlertCircle, ArrowLeft, Mail, Send, Inbox, ShieldCheck, Loader2, X, Clock, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { sendDeliverabilityTestEmail, confirmEmailDeliverability } from '@/lib/api-emails'
import { formatPhoneNumber, formatPhoneInput } from '@/lib/utils/phone-utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function SettingsPage() {
  const router = useRouter()
  const { user, token, loading: authLoading, refreshUser, supabaseUser } = useAuth()

  // Profile form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Email verification state
  const [emailTestSending, setEmailTestSending] = useState(false)
  const [emailTestSent, setEmailTestSent] = useState(false)
  const [emailTestError, setEmailTestError] = useState('')
  const [emailConfirming, setEmailConfirming] = useState(false)
  const [emailConfirmError, setEmailConfirmError] = useState('')
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)

  // Check if user signed in with Google (no password change option)
  const isOAuthUser = supabaseUser?.app_metadata?.provider === 'google'

  // Check if email deliverability is confirmed
  const isEmailConfirmed = user?.email_deliverability_confirmed || false
  const hasTestBeenSent = user?.email_test_sent_at || emailTestSent

  // Initialize form values when user loads
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '')
      setLastName(user.last_name || '')
      setPhone(formatPhoneNumber(user.phone))
    }
  }, [user])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    setProfileLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone ? phone.replace(/\D/g, '') : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to update profile')
      }

      await refreshUser()
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  // Handle sending test email for deliverability
  const handleSendTestEmail = async () => {
    if (!token) return

    setEmailTestSending(true)
    setEmailTestError('')

    try {
      await sendDeliverabilityTestEmail(token)
      setEmailTestSent(true)
      await refreshUser()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send test email'
      // Check if it's a rate limit error (message contains "limit" or "24 hours")
      if (errorMessage.toLowerCase().includes('limit') || errorMessage.includes('429')) {
        setShowRateLimitModal(true)
      } else {
        setEmailTestError(errorMessage)
      }
    } finally {
      setEmailTestSending(false)
    }
  }

  // Handle confirming email deliverability
  const handleConfirmEmail = async () => {
    if (!token) return

    setEmailConfirming(true)
    setEmailConfirmError('')

    try {
      await confirmEmailDeliverability(token)
      await refreshUser()
    } catch (err) {
      setEmailConfirmError(err instanceof Error ? err.message : 'Failed to confirm deliverability')
    } finally {
      setEmailConfirming(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    // Validate current password is provided
    if (!currentPassword) {
      setPasswordError('Please enter your current password')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long')
      return
    }

    setPasswordLoading(true)

    try {
      // First, verify the current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      })

      if (signInError) {
        throw new Error('Current password is incorrect')
      }

      // Current password verified - now update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        throw new Error(error.message)
      }

      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-camp-green border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Determine which view type to use for the header
  const getHeaderViewType = () => {
    if (user.role === 'super_admin') return 'super-admin'
    if (user.role === 'admin') return 'admin'
    return 'user'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader currentView={getHeaderViewType()} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-camp-green mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-camp-charcoal mb-8">Account Settings</h1>

        <div className="space-y-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-camp-green/10 rounded-lg">
                  <User className="h-5 w-5 text-camp-green" />
                </div>
                <div>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                {profileError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {profileError}
                  </div>
                )}

                {profileSuccess && (
                  <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    Profile updated successfully!
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                  />
                  <Input
                    label="Last Name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>

                <Input
                  label="Email Address"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 -mt-2">
                  Email cannot be changed. Contact support if you need to update it.
                </p>

                <Input
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(123) 456-7890"
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={profileLoading}
                    disabled={profileLoading}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Email Deliverability Section */}
          <Card className={`overflow-hidden transition-all duration-300 ${isEmailConfirmed ? 'ring-2 ring-green-500/50' : 'ring-2 ring-amber-400/50'}`}>
            <CardHeader className={`${isEmailConfirmed
              ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500'
              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-camp-orange'} text-white`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 ${isEmailConfirmed ? 'bg-white/20' : 'bg-white/20'} rounded-lg`}>
                  {isEmailConfirmed ? (
                    <ShieldCheck className="h-6 w-6" />
                  ) : (
                    <Mail className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    Email Deliverability
                    {isEmailConfirmed && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                        Verified
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    {isEmailConfirmed
                      ? "You're all set to receive important notifications!"
                      : "Ensure you receive important notifications from CAMP FASD"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isEmailConfirmed ? (
                // Confirmed State - Success message
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Deliverability Confirmed!</h3>
                  <p className="text-gray-600 text-sm max-w-md mx-auto">
                    Great job! You'll receive important updates about your camper's application, acceptance status,
                    and payment reminders directly to your inbox.
                  </p>
                  {user?.email_deliverability_confirmed_at && (
                    <p className="text-xs text-gray-400 mt-3">
                      Confirmed on {new Date(user.email_deliverability_confirmed_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              ) : (
                // Not confirmed - Show verification flow
                <div className="space-y-6">
                  {/* Why this matters */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 text-sm">Why is this important?</p>
                        <p className="text-amber-700 text-sm mt-1">
                          We send critical updates about your application, acceptance status, payment reminders, and camp information.
                          If our emails go to spam, you might miss important deadlines!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step Indicators */}
                  <div className="flex items-center justify-center gap-2">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      hasTestBeenSent
                        ? 'bg-green-100 text-green-700'
                        : 'bg-camp-orange/10 text-camp-orange'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        hasTestBeenSent ? 'bg-green-500 text-white' : 'bg-camp-orange text-white'
                      }`}>
                        {hasTestBeenSent ? <CheckCircle className="h-4 w-4" /> : '1'}
                      </div>
                      Send Test
                    </div>
                    <div className="w-8 h-0.5 bg-gray-200"></div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                      !hasTestBeenSent
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-camp-orange/10 text-camp-orange'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        !hasTestBeenSent ? 'bg-gray-300 text-white' : 'bg-camp-orange text-white'
                      }`}>
                        2
                      </div>
                      Confirm
                    </div>
                  </div>

                  {/* Error Messages */}
                  {emailTestError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {emailTestError}
                    </div>
                  )}
                  {emailConfirmError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {emailConfirmError}
                    </div>
                  )}

                  {/* Step 1: Send Test Email */}
                  <div className={`p-5 rounded-xl border-2 transition-all ${
                    hasTestBeenSent
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-camp-orange/30 bg-gradient-to-br from-orange-50 to-amber-50'
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl flex-shrink-0 ${
                        hasTestBeenSent ? 'bg-green-100' : 'bg-white shadow-sm'
                      }`}>
                        {hasTestBeenSent ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <Send className="h-6 w-6 text-camp-orange" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {hasTestBeenSent ? 'Test Email Sent!' : 'Step 1: Send a Test Email'}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {hasTestBeenSent
                            ? `We sent a test email to ${user?.email}. Check your inbox (and spam folder).`
                            : `We'll send a test email to ${user?.email} to verify you can receive our messages.`
                          }
                        </p>
                        {!hasTestBeenSent && (
                          <Button
                            onClick={handleSendTestEmail}
                            disabled={emailTestSending}
                            className="mt-3 bg-camp-orange hover:bg-camp-orange/90 text-white"
                          >
                            {emailTestSending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Send Test Email
                              </>
                            )}
                          </Button>
                        )}
                        {hasTestBeenSent && !isEmailConfirmed && (
                          <button
                            onClick={handleSendTestEmail}
                            disabled={emailTestSending}
                            className="mt-2 text-sm text-gray-500 hover:text-camp-orange transition-colors"
                          >
                            {emailTestSending ? 'Sending...' : 'Resend test email'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Confirm Receipt */}
                  <div className={`p-5 rounded-xl border-2 transition-all ${
                    hasTestBeenSent
                      ? 'border-camp-orange/30 bg-gradient-to-br from-orange-50 to-amber-50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl flex-shrink-0 ${
                        hasTestBeenSent ? 'bg-white shadow-sm' : 'bg-gray-200'
                      }`}>
                        <Inbox className={`h-6 w-6 ${hasTestBeenSent ? 'text-camp-orange' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-semibold ${hasTestBeenSent ? 'text-gray-900' : 'text-gray-400'}`}>
                          Step 2: Confirm Receipt
                        </h4>
                        <p className={`text-sm mt-1 ${hasTestBeenSent ? 'text-gray-600' : 'text-gray-400'}`}>
                          Once you've found the email (in your inbox or spam), click below to confirm.
                          If it was in spam, please mark it as "Not Spam" and add <strong className="text-camp-green">apps@fasdcamp.org</strong> to your contacts.
                        </p>
                        {hasTestBeenSent && (
                          <Button
                            onClick={handleConfirmEmail}
                            disabled={emailConfirming || !hasTestBeenSent}
                            className="mt-3 bg-camp-green hover:bg-camp-green/90 text-white"
                          >
                            {emailConfirming ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Confirming...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                I Received the Email
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Password Section (only for non-OAuth users) */}
          {!isOAuthUser && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Lock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your account password</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {passwordError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      Password changed successfully!
                    </div>
                  )}

                  <Input
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                    required
                  />

                  <div className="border-t border-gray-200 my-2" />

                  <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />

                  <p className="text-xs text-gray-500">
                    Password must be at least 8 characters long
                  </p>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={passwordLoading}
                      disabled={passwordLoading}
                    >
                      Change Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* OAuth Notice (for Google users) */}
          {isOAuthUser && (
            <Card className="bg-gray-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-gray-600">
                  <Lock className="h-5 w-5" />
                  <p className="text-sm">
                    You signed in with Google. Password management is handled through your Google account.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Rate Limit Modal */}
      {showRateLimitModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRateLimitModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 text-white relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/10 rounded-full" />

              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Clock className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Email Limit Reached</h2>
                    <p className="text-white/80 text-sm mt-1">3 test emails sent today</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRateLimitModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Explanation */}
              <div className="text-center">
                <p className="text-gray-700 leading-relaxed">
                  To prevent accidental spam, you can only send <strong className="text-amber-600">3 test emails</strong> within a 24-hour period.
                </p>
              </div>

              {/* Timer visual */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-800">Try again in 24 hours</p>
                    <p className="text-xs text-amber-600 mt-0.5">Your limit will reset automatically</p>
                  </div>
                </div>
              </div>

              {/* Still need help section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Still not receiving emails?</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Contact our support team for technical assistance:
                    </p>
                    <a
                      href="mailto:admin@fasdcamp.org?subject=Email%20Deliverability%20Help"
                      className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      admin@fasdcamp.org
                    </a>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Quick Tips</p>
                <ul className="text-sm text-gray-600 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Check your spam/junk folder for previous test emails
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Add <strong className="text-camp-green">apps@fasdcamp.org</strong> to your contacts
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Check if your email provider blocks automated emails
                  </li>
                </ul>
              </div>

              {/* Action button */}
              <Button
                onClick={() => setShowRateLimitModal(false)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3"
              >
                Got it, I'll wait
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
