/**
 * Beta Feedback Handler
 *
 * Integrates React Roast with Supabase to store comprehensive feedback data
 * including screenshots, console logs, browser metadata, and user context.
 *
 * This is called by the React Roast widget's onFormSubmit callback.
 */

import { supabase } from './supabase-client'
import { consoleLogger } from './console-logger'
import { collectMetadataForStorage } from './metadata-collector'

// Type definition from react-roast
export interface FormDataProps {
  email?: string
  message: string
  screenshotBlobs: Array<{
    blob: Blob
    type: 'full-screenshot' | 'selected-screenshot'
  }>
}

/**
 * Upload a screenshot blob to Supabase Storage
 */
async function uploadScreenshot(
  blob: Blob,
  type: 'full-screenshot' | 'selected-screenshot'
): Promise<string | null> {
  try {
    // Generate unique filename
    const timestamp = Date.now()
    const fileName = `${timestamp}-${type}.png`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('beta-feedback-screenshots')
      .upload(fileName, blob, {
        contentType: 'image/png',
        cacheControl: '3600',
      })

    if (error) {
      console.error('Screenshot upload error:', error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('beta-feedback-screenshots')
      .getPublicUrl(fileName)

    return urlData.publicUrl
  } catch (error) {
    console.error('Failed to upload screenshot:', error)
    return null
  }
}

/**
 * Get current user from localStorage
 * Extracts user ID and email from JWT token
 */
function getCurrentUser(): { id: string; email: string } | null {
  try {
    // Get token from localStorage (stored by AuthContext)
    const token = localStorage.getItem('camp_token')
    if (!token) return null

    // Decode JWT to get user info (simple base64 decode of payload)
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(atob(parts[1]))

    // The FastAPI backend stores user ID in 'sub' claim
    // Email and other user info should also be in the payload
    if (payload.sub) {
      return {
        id: payload.sub,
        email: payload.email || payload.user_email || 'unknown', // Try multiple fields
      }
    }

    return null
  } catch (error) {
    console.error('Failed to decode token:', error)
    return null
  }
}

/**
 * Main feedback submission handler
 * Called by React Roast's onFormSubmit prop
 */
export async function handleFeedbackSubmit(
  data: FormDataProps
): Promise<boolean> {
  try {
    console.log('📝 Submitting feedback...')

    // Get current user
    const currentUser = getCurrentUser()

    // Collect all metadata
    const metadata = collectMetadataForStorage()
    const consoleLogs = consoleLogger.getLogs()

    // Upload screenshots
    console.log('📸 Uploading screenshots...')
    const screenshotUploads = await Promise.all(
      data.screenshotBlobs.map((screenshot) =>
        uploadScreenshot(screenshot.blob, screenshot.type)
      )
    )

    // Separate full vs element screenshots
    const fullScreenshotUrl = screenshotUploads.find((_, index) =>
      data.screenshotBlobs[index].type === 'full-screenshot'
    )
    const elementScreenshotUrl = screenshotUploads.find((_, index) =>
      data.screenshotBlobs[index].type === 'selected-screenshot'
    )

    // Prepare feedback record
    const feedbackRecord = {
      // User info
      user_id: currentUser?.id || null,
      user_email: data.email || currentUser?.email || 'anonymous',

      // Feedback content
      message: data.message,
      page_url: metadata.url,
      page_pathname: metadata.pathname,

      // Screenshots
      full_screenshot_url: fullScreenshotUrl || null,
      element_screenshot_url: elementScreenshotUrl || null,

      // Metadata
      browser_info: metadata.browserInfo,
      viewport_size: metadata.viewportSize,
      device_info: metadata.deviceInfo,
      performance_metrics: metadata.performanceMetrics,

      // Console logs
      console_logs: consoleLogs,

      // TODO: Add selected_element info when React Roast provides it
      selected_element: {},

      // Status
      status: 'new',
    }

    console.log('💾 Saving feedback to database...')

    // Insert feedback into database
    const { data: insertedData, error: insertError } = await supabase
      .from('beta_feedback')
      .insert(feedbackRecord)
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return false
    }

    console.log('✅ Feedback submitted successfully!', insertedData)

    // Clear console logs after successful submission
    consoleLogger.clearLogs()

    return true
  } catch (error) {
    console.error('❌ Failed to submit feedback:', error)
    return false
  }
}

// Cache for the feedback setting to avoid repeated API calls
let feedbackSettingCache: boolean | null = null
let feedbackSettingPromise: Promise<boolean> | null = null

/**
 * Fetch the feedback widget setting from the public config API
 */
async function fetchFeedbackSetting(): Promise<boolean> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const response = await fetch(`${apiUrl}/api/public/config/enable_feedback_widget`)

    if (!response.ok) {
      // If config doesn't exist, default to enabled
      return true
    }

    const data = await response.json()
    return data.value === 'true' || data.value === true
  } catch {
    // On error, default to enabled
    return true
  }
}

/**
 * Helper to check if feedback widget should be enabled
 * Checks the super admin configuration setting
 */
export function shouldEnableFeedback(): boolean {
  // Always enable in development for testing
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // For non-development, check the cached setting
  // Return cached value if available, otherwise trigger async fetch
  if (feedbackSettingCache !== null) {
    return feedbackSettingCache
  }

  // Start fetching if not already in progress
  if (!feedbackSettingPromise) {
    feedbackSettingPromise = fetchFeedbackSetting().then((result) => {
      feedbackSettingCache = result
      return result
    })
  }

  // Default to enabled while loading (will update on next check)
  return true
}

/**
 * Async version to get the feedback setting with proper await
 * Use this when you can handle async (e.g., in useEffect)
 */
export async function getFeedbackEnabled(): Promise<boolean> {
  // Always enable in development
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // Return cached value if available
  if (feedbackSettingCache !== null) {
    return feedbackSettingCache
  }

  // Fetch and cache
  if (!feedbackSettingPromise) {
    feedbackSettingPromise = fetchFeedbackSetting().then((result) => {
      feedbackSettingCache = result
      return result
    })
  }

  return feedbackSettingPromise
}
