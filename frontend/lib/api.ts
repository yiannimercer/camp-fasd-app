/**
 * API client for communicating with the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role: string
  team?: string
  email_verified: boolean
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

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface CheckLegacyUserResponse {
  exists: boolean
  is_legacy_user: boolean
  needs_password_setup: boolean
  password_reset_sent: boolean
  message: string
}

/**
 * Check if an email belongs to a legacy user who needs password setup.
 * This is called before login to provide a seamless experience for
 * users migrated from the legacy WordPress system.
 */
export async function checkLegacyUser(email: string): Promise<CheckLegacyUserResponse> {
  const response = await fetch(`${API_URL}/api/auth/check-legacy-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    // Don't throw on error - just return a default response
    return {
      exists: false,
      is_legacy_user: false,
      needs_password_setup: false,
      password_reset_sent: false,
      message: '',
    }
  }

  return response.json()
}

/**
 * Mark a legacy user's password as set after they complete the reset flow.
 */
export async function markPasswordSet(email: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/api/auth/mark-password-set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    return { success: false }
  }

  return response.json()
}

/**
 * Login with email and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Login failed')
  }

  return response.json()
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Registration failed')
  }

  return response.json()
}

/**
 * Get current user info
 */
export async function getCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get user info')
  }

  return response.json()
}

/**
 * Logout (client-side token removal)
 */
export async function logout(token: string): Promise<void> {
  // Call backend logout endpoint (optional, for logging purposes)
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
}