/**
 * Login Page
 * Modern, accessible login form with CAMP FASD branding and nature-inspired design
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import GoogleLoginButton from '@/components/GoogleLoginButton'
import { TreePine, Sun, Sparkles, Mountain } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push('/dashboard')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login({ email, password })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-emerald-50/30 flex items-center justify-center p-4 overflow-hidden">
      {/* Floating Nature Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Sun with glow */}
        <div className="absolute top-10 left-[10%] animate-float-slow">
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
        <div className="absolute top-[20%] right-[8%] animate-float-gentle">
          <Sparkles className="w-5 h-5 text-amber-400/30" />
        </div>
        <div className="absolute top-[45%] left-[10%] animate-float-gentle-delayed">
          <Sparkles className="w-4 h-4 text-camp-orange/25" />
        </div>
        <div className="absolute top-[65%] right-[12%] animate-float-gentle">
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
                Camper Application Portal
              </p>
            </div>
          </div>
        </Link>

        {/* Login Card */}
        <Card className="backdrop-blur-sm bg-white/90 shadow-xl border-white/50 animate-fade-in-up">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-camp-charcoal">Welcome Back</CardTitle>
            <CardDescription className="text-gray-600">
              Enter your credentials to access your account
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

              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-camp-green focus:ring-camp-green focus:ring-offset-0"
                  />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-camp-green hover:text-camp-orange transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>
            </CardContent>

            <CardFooter className="flex-col space-y-4 pt-2">
              {/* Google Sign In - Staff (@fasdcamp.org) */}
              <div className="w-full">
                <p className="text-xs text-center text-gray-500 mb-3">
                  Staff members sign in with Google
                </p>
                <GoogleLoginButton />
              </div>

              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400 font-medium">
                    Or families sign in with email
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full bg-gradient-to-r from-camp-green to-emerald-600 hover:from-camp-green/90 hover:to-emerald-600/90 shadow-lg shadow-camp-green/20 hover:shadow-xl hover:shadow-camp-green/25 transition-all"
                isLoading={isLoading}
                disabled={isLoading}
              >
                Sign In with Email
              </Button>

              <p className="text-sm text-center text-gray-500 pt-2">
                Don't have an account?{' '}
                <Link
                  href="/register"
                  className="text-camp-green hover:text-camp-orange font-semibold transition-colors"
                >
                  Sign up
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
