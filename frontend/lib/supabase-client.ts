/**
 * Supabase Client Configuration
 *
 * Creates a Supabase client for authentication, database, and storage access.
 * Uses Supabase Auth for user authentication with session persistence.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

/**
 * Get or create Supabase client instance (lazy initialization)
 * This prevents errors at module load time if env vars aren't set yet
 */
function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL:', supabaseUrl ? 'Set' : 'Missing')
    console.error('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Missing')
    throw new Error(
      'Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file and restart the dev server.'
    )
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Storage key for the session
      storageKey: 'camp-fasd-auth',
      // Use localStorage for session persistence
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })

  return supabaseInstance
}

// Export the getter function as 'supabase' for convenience
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    const client = getSupabaseClient()
    return (client as any)[prop]
  },
})

export default supabase
