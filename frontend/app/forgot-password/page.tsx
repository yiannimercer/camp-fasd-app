/**
 * Forgot Password Page
 * Allows users to request a password reset email via Supabase Auth
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { TreePine, ArrowLeft, Mail, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await resetPassword(email)
      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
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
            <>
              <CardHeader className="space-y-1 pb-4 text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-camp-charcoal">Check Your Email</CardTitle>
                <CardDescription className="text-gray-600">
                  We've sent a password reset link to <strong>{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500 text-center">
                  Click the link in the email to reset your password. If you don't see it, check your spam folder.
                </p>
              </CardContent>
              <CardFooter className="flex-col space-y-4 pt-2">
                <Link href="/login" className="w-full">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full bg-gradient-to-r from-camp-green to-emerald-600"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-amber-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-camp-charcoal text-center">Forgot Password?</CardTitle>
                <CardDescription className="text-gray-600 text-center">
                  No worries! Enter your email and we'll send you a reset link.
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                      <div className="flex items-center">
                        <svg
                          className="w-5 h-5 text-red-500 mr-2 flex-shrink-0"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  )}

                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </CardContent>

                <CardFooter className="flex-col space-y-4 pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full bg-gradient-to-r from-camp-green to-emerald-600 hover:from-camp-green/90 hover:to-emerald-600/90 shadow-lg shadow-camp-green/20"
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    Send Reset Link
                  </Button>

                  <Link
                    href="/login"
                    className="text-sm text-camp-green hover:text-camp-orange font-medium transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </Link>
                </CardFooter>
              </form>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-gray-400 mt-8">
          © {new Date().getFullYear()} CAMP FASD. All rights reserved.
        </p>
      </div>
    </div>
  )
}
