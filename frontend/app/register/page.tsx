/**
 * Registration Page
 * Modern sign-up form with CAMP FASD branding and nature-inspired design
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { TreePine, Sun, Sparkles, Mountain } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { register, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push('/dashboard')
    return null
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)

    try {
      await register({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
        phone: formData.phone || undefined,
      })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-emerald-50/30 flex items-center justify-center p-4 overflow-hidden">
      {/* Floating Nature Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Sun with glow */}
        <div className="absolute top-10 right-[10%] animate-float-slow">
          <div className="relative">
            <div className="absolute inset-0 w-24 h-24 bg-amber-300/20 rounded-full blur-2xl" />
            <Sun className="w-16 h-16 text-amber-400/40" strokeWidth={1.5} />
          </div>
        </div>

        {/* Decorative trees */}
        <TreePine className="absolute bottom-0 left-[5%] w-32 h-32 text-camp-green/10 transform -rotate-3" />
        <TreePine className="absolute bottom-0 left-[12%] w-24 h-24 text-camp-green/8 transform rotate-2" />
        <TreePine className="absolute bottom-0 right-[5%] w-28 h-28 text-camp-green/10 transform rotate-3" />
        <TreePine className="absolute bottom-0 right-[15%] w-20 h-20 text-camp-green/8 transform -rotate-2" />

        {/* Mountain silhouettes */}
        <Mountain className="absolute bottom-0 left-[25%] w-48 h-48 text-emerald-800/5" />
        <Mountain className="absolute bottom-0 right-[20%] w-40 h-40 text-emerald-700/5" />

        {/* Floating sparkles */}
        <div className="absolute top-[25%] left-[8%] animate-float-gentle">
          <Sparkles className="w-5 h-5 text-amber-400/30" />
        </div>
        <div className="absolute top-[40%] right-[10%] animate-float-gentle-delayed">
          <Sparkles className="w-4 h-4 text-camp-orange/25" />
        </div>
        <div className="absolute top-[60%] left-[12%] animate-float-gentle">
          <Sparkles className="w-3 h-3 text-camp-green/25" />
        </div>
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Logo/Header with Link to Home */}
        <Link href="/" className="block text-center mb-8 group animate-fade-in">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-camp-green to-emerald-600 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all">
              <TreePine className="h-7 w-7 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-camp-green to-emerald-600 bg-clip-text text-transparent">
                CAMP FASD
              </h1>
              <p className="text-sm text-gray-500">
                Join Our Community
              </p>
            </div>
          </div>
        </Link>

        {/* Registration Card */}
        <Card className="backdrop-blur-sm bg-white/90 shadow-xl border-white/50 animate-fade-in-up">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-camp-charcoal">Create Account</CardTitle>
            <CardDescription className="text-gray-600">
              Enter your information to get started with your application
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-fade-in">
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

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="first_name"
                  type="text"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={handleChange}
                  disabled={isLoading}
                  autoComplete="given-name"
                />

                <Input
                  label="Last Name"
                  name="last_name"
                  type="text"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={handleChange}
                  disabled={isLoading}
                  autoComplete="family-name"
                />
              </div>

              <Input
                label="Email Address"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="email"
              />

              <Input
                label="Phone Number"
                name="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="tel"
              />

              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="new-password"
              />

              <Input
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="new-password"
              />

              <div className="flex items-start space-x-3 text-sm">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-camp-green focus:ring-camp-green focus:ring-offset-0"
                />
                <label className="text-gray-600 leading-relaxed">
                  I agree to the{' '}
                  <Link href="/terms" className="text-camp-green hover:text-camp-orange font-medium transition-colors">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-camp-green hover:text-camp-orange font-medium transition-colors">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </CardContent>

            <CardFooter className="flex-col space-y-4 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full bg-gradient-to-r from-camp-green to-emerald-600 hover:from-camp-green/90 hover:to-emerald-600/90 shadow-lg shadow-camp-green/20 hover:shadow-xl hover:shadow-camp-green/25 transition-all"
                isLoading={isLoading}
                disabled={isLoading}
              >
                Create Account
              </Button>

              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400 font-medium">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full border-2 border-gray-200 hover:border-camp-green/30 hover:bg-camp-green/5 transition-all group"
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-gray-700 group-hover:text-camp-charcoal transition-colors">
                  Sign up with Google
                </span>
              </Button>

              <p className="text-sm text-center text-gray-500 pt-2">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-camp-green hover:text-camp-orange font-semibold transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-8 animate-fade-in">
          © {new Date().getFullYear()} CAMP FASD. All rights reserved.
        </p>
      </div>
    </div>
  )
}
