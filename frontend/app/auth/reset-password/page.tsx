/**
 * Reset Password Page
 * Allows users to set a new password after clicking the reset link
 * Supabase handles the token validation automatically when this page loads
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { supabase } from '@/lib/supabase-client'
import { markPasswordSet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { TreePine, Lock, CheckCircle, AlertCircle, Sun, Sparkles, ShieldCheck, KeyRound, PartyPopper } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)

  // Check if user has a valid reset session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // If there's a session with a recovery token, we're in password recovery mode
      if (session) {
        setIsValidSession(true)
      } else {
        // Check URL for error parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        if (error) {
          setError(errorDescription || 'Invalid or expired reset link')
          setIsValidSession(false)
        } else {
          // Wait a moment for Supabase to process the URL
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession()
            setIsValidSession(!!retrySession)
            if (!retrySession) {
              setError('Invalid or expired reset link. Please request a new one.')
            }
          }, 1000)
        }
      }
    }

    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)

    try {
      await updatePassword(password)

      // Get the current user's email to mark password as set
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        // Mark password as set for legacy users (this is a no-op for non-legacy users)
        await markPasswordSet(user.email)
      }

      setIsSuccess(true)

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-emerald-50/30 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-amber-500 animate-pulse" />
            </div>
          </div>
          <div>
            <p className="text-gray-700 font-medium">Verifying your link...</p>
            <p className="text-sm text-gray-500 mt-1">Just a moment</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-emerald-50/30 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md z-10">
        {/* Logo/Header */}
        <Link href="/" className="block text-center mb-8 group">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-camp-green to-emerald-600 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all">
              <TreePine className="h-7 w-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-camp-green to-emerald-600 bg-clip-text text-transparent">
                CAMP FASD
              </h1>
              <p className="text-sm text-gray-500">
                Camper Application Portal
              </p>
            </div>
          </div>
        </Link>

        <Card className="backdrop-blur-sm bg-white/90 shadow-xl border-white/50">
          {isSuccess ? (
            <div className="overflow-hidden">
              {/* Celebratory header */}
              <div className="relative bg-gradient-to-br from-emerald-400 via-emerald-500 to-camp-green px-6 py-8 text-white overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                <Sparkles className="absolute top-4 right-4 w-6 h-6 text-emerald-200/50 animate-pulse" />
                <Sparkles className="absolute bottom-4 left-4 w-5 h-5 text-emerald-200/40 animate-pulse" style={{ animationDelay: '0.5s' }} />

                <div className="relative z-10 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                    <PartyPopper className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight">You&apos;re All Set!</h3>
                    <p className="text-emerald-100 text-sm mt-1">Your password has been updated</p>
                  </div>
                </div>
              </div>

              {/* Success message */}
              <div className="px-6 py-6 text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Account secured</span>
                </div>
                <p className="text-sm text-gray-500">
                  Taking you to your dashboard...
                </p>
                <div className="flex justify-center">
                  <div className="h-1 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            </div>
          ) : !isValidSession ? (
            <>
              <CardHeader className="space-y-1 pb-4 text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-camp-charcoal">Link Expired</CardTitle>
                <CardDescription className="text-gray-600">
                  {error || 'This password reset link is invalid or has expired.'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex-col space-y-4 pt-2">
                <Link href="/forgot-password" className="w-full">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full bg-gradient-to-r from-camp-green to-emerald-600"
                  >
                    Request New Link
                  </Button>
                </Link>
                <Link
                  href="/login"
                  className="text-sm text-gray-500 hover:text-camp-green transition-colors"
                >
                  Back to Login
                </Link>
              </CardFooter>
            </>
          ) : (
            <div className="overflow-hidden">
              {/* Warm header matching the login welcome */}
              <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-camp-orange px-6 py-6 text-white overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <Sun className="absolute top-3 right-3 w-6 h-6 text-amber-200/40 animate-pulse" />

                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                    <KeyRound className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Final Step!</h3>
                    <p className="text-amber-100 text-sm">Create your new password</p>
                  </div>
                </div>
              </div>

              {/* Progress indicator */}
              <div className="px-6 pt-5 pb-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>Almost there...</span>
                  <span className="font-medium text-emerald-600">Step 3 of 3</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: '90%' }} />
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  )}

                  <Input
                    label="New Password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />

                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter to confirm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />

                  {/* Password requirements */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">Password requirements:</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${password.length >= 8 ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                      <span className={`text-xs ${password.length >= 8 ? 'text-emerald-700' : 'text-gray-500'}`}>
                        At least 8 characters
                      </span>
                    </div>
                    {password && confirmPassword && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${password === confirmPassword ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                        <span className={`text-xs ${password === confirmPassword ? 'text-emerald-700' : 'text-gray-500'}`}>
                          Passwords match
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex-col space-y-3 pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full bg-gradient-to-r from-camp-green to-emerald-600 hover:from-camp-green/90 hover:to-emerald-600/90 shadow-lg shadow-camp-green/20 hover:shadow-xl transition-all"
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Securing your account...' : 'Complete Setup'}
                  </Button>
                  <p className="text-xs text-center text-gray-400">
                    🔒 Your password is encrypted and secure
                  </p>
                </CardFooter>
              </form>
            </div>
          )}
        </Card>

        <p className="text-center text-sm text-gray-400 mt-8">
          © {new Date().getFullYear()} CAMP FASD. All rights reserved.
        </p>
      </div>
    </div>
  )
}
