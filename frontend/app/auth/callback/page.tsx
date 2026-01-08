/**
 * OAuth Callback Page
 * Handles the redirect from Supabase OAuth (Google sign-in)
 * Supabase Auth will redirect here after successful OAuth authentication
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { TreePine } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase handles the OAuth callback automatically
        // We just need to wait for the session to be established
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (session) {
          // Get user details to determine redirect
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            // Fetch our app user to get role
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${API_URL}/api/auth/me`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            })

            if (response.ok) {
              const appUser = await response.json()

              // Redirect based on role
              if (appUser.role === 'super_admin') {
                router.push('/super-admin')
              } else if (appUser.role === 'admin') {
                router.push('/admin/applications')
              } else {
                router.push('/dashboard')
              }
              return
            }
          }

          // Default redirect if we can't get user info
          router.push('/dashboard')
        } else {
          // No session, redirect to login
          setError('Authentication failed. Please try again.')
          setTimeout(() => router.push('/login'), 3000)
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setTimeout(() => router.push('/login'), 3000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-emerald-50/30 flex items-center justify-center p-4">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-500 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
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
            </div>
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <p className="text-gray-500 text-sm">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-camp-green to-emerald-600 rounded-xl shadow-lg">
                <TreePine className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-camp-green border-r-transparent mb-4"></div>
            <p className="text-gray-600 font-medium">Completing sign in...</p>
            <p className="text-gray-400 text-sm mt-1">Please wait while we set up your session</p>
          </>
        )}
      </div>
    </div>
  )
}
