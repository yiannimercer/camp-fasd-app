/**
 * Authentication Context
 * Manages user authentication state using Supabase Auth
 */

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Session, User as SupabaseUser, AuthError, AuthResponse } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'

// Our application's user type (from public.users table)
export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  role: string
  team?: string
  email_verified: boolean
  receive_emails?: boolean
  email_deliverability_confirmed: boolean
  email_test_sent_at?: string
  email_deliverability_confirmed_at?: string
  created_at?: string
  last_login?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  first_name?: string
  last_name?: string
  phone?: string
}

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  session: Session | null
  token: string | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  loginWithGoogle: () => Promise<void>
  register: (data: RegisterData) => Promise<AuthResponse['data'] | undefined>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch our application user from the backend using Supabase token
  const fetchAppUser = useCallback(async (accessToken: string): Promise<User | null> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        console.error('Failed to fetch user:', response.status)
        return null
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching user:', error)
      return null
    }
  }, [])

  // Refresh user data from the backend
  const refreshUser = useCallback(async () => {
    if (session?.access_token) {
      const appUser = await fetchAppUser(session.access_token)
      if (appUser) {
        setUser(appUser)
      }
    }
  }, [session, fetchAppUser])

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session: currentSession } } = await supabase.auth.getSession()

        if (currentSession) {
          setSession(currentSession)
          setSupabaseUser(currentSession.user)

          // Fetch our application user
          const appUser = await fetchAppUser(currentSession.access_token)
          setUser(appUser)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event)

      setSession(newSession)
      setSupabaseUser(newSession?.user ?? null)

      if (newSession) {
        // Fetch our application user
        const appUser = await fetchAppUser(newSession.access_token)
        setUser(appUser)
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchAppUser])

  // Login with email and password
  const login = async (credentials: LoginCredentials) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.session) {
        setSession(data.session)
        setSupabaseUser(data.user)

        const appUser = await fetchAppUser(data.session.access_token)
        setUser(appUser)
      }
    } finally {
      setLoading(false)
    }
  }

  // Login with Google OAuth
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      throw new Error(error.message)
    }
    // The page will redirect to Google, so no need to handle success here
  }

  // Register new user
  // Returns authData so caller can check if session exists (null if email confirmation required)
  const register = async (data: RegisterData) => {
    setLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      if (authData.session) {
        setSession(authData.session)
        setSupabaseUser(authData.user)

        const appUser = await fetchAppUser(authData.session.access_token)
        setUser(appUser)
      }

      // Return authData so caller can check if email confirmation is required
      // (session will be null if confirmation is needed)
      return authData
    } finally {
      setLoading(false)
    }
  }

  // Logout
  const logout = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
      }
      setUser(null)
      setSupabaseUser(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  // Request password reset email
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  // Update password (when user has reset token)
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const value = {
    user,
    supabaseUser,
    session,
    token: session?.access_token ?? null,
    loading,
    login,
    loginWithGoogle,
    register,
    logout,
    resetPassword,
    updatePassword,
    isAuthenticated: !!user && !!session,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
