'use client'

/**
 * Status Colors Context
 * Provides dynamic status/stage colors throughout the application.
 * Colors are fetched from the API (configurable by super admins) with fallback to defaults.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { StatusColorsMap, StatusColorConfig, StatusColorKey } from '@/lib/utils/status-colors'

// Default colors (fallback if API fails or hasn't loaded yet)
export const DEFAULT_STATUS_COLORS: StatusColorsMap = {
  applicant_not_started: { bg: '#F3F4F6', text: '#1F2937', label: 'Not Started' },
  applicant_incomplete: { bg: '#DBEAFE', text: '#1E40AF', label: 'Incomplete' },
  applicant_complete: { bg: '#E0E7FF', text: '#3730A3', label: 'Complete' },
  applicant_under_review: { bg: '#FEF3C7', text: '#92400E', label: 'Under Review' },
  applicant_waitlist: { bg: '#FFEDD5', text: '#9A3412', label: 'Waitlist' },
  camper_incomplete: { bg: '#CFFAFE', text: '#0E7490', label: 'Incomplete' },
  camper_complete: { bg: '#D1FAE5', text: '#065F46', label: 'Complete' },
  inactive_withdrawn: { bg: '#FFEDD5', text: '#C2410C', label: 'Withdrawn' },
  inactive_deferred: { bg: '#FEF3C7', text: '#B45309', label: 'Deferred' },
  inactive_inactive: { bg: '#F3F4F6', text: '#4B5563', label: 'Deactivated' },
  category_applicant: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Applicant' },
  category_camper: { bg: '#F3E8FF', text: '#7C3AED', label: 'Camper' },
  category_inactive: { bg: '#F3F4F6', text: '#4B5563', label: 'Inactive' },
}

interface StatusColorsContextType {
  colors: StatusColorsMap
  loading: boolean
  /** Get color config for a status + sub-status combination */
  getStatusColor: (status: string, subStatus: string) => StatusColorConfig
  /** Get color config for a main status category (Applicant/Camper/Inactive) */
  getCategoryColor: (status: string) => StatusColorConfig
  /** Get inline styles for a status + sub-status combination */
  getStatusStyle: (status: string, subStatus: string) => React.CSSProperties
  /** Get inline styles for a main status category */
  getCategoryStyle: (status: string) => React.CSSProperties
  /** Get CSS class string (for when you need Tailwind-compatible classes) */
  getStatusClasses: (status: string, subStatus: string) => string
  /** Refresh colors from API (call after saving changes) */
  refreshColors: () => Promise<void>
}

const StatusColorsContext = createContext<StatusColorsContextType | undefined>(undefined)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function StatusColorsProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<StatusColorsMap>(DEFAULT_STATUS_COLORS)
  const [loading, setLoading] = useState(true)

  const fetchColors = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/public/config/status_colors`)
      if (response.ok) {
        const data = await response.json()
        // Merge with defaults to ensure all keys exist even if some are missing
        if (data.value && typeof data.value === 'object') {
          setColors({ ...DEFAULT_STATUS_COLORS, ...data.value })
        }
      }
    } catch (error) {
      console.error('Failed to fetch status colors:', error)
      // Keep default colors on error - app still works
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchColors()
  }, [fetchColors])

  const getStatusColor = useCallback((status: string, subStatus: string): StatusColorConfig => {
    const key = `${status}_${subStatus}` as StatusColorKey
    return colors[key] || DEFAULT_STATUS_COLORS.applicant_not_started
  }, [colors])

  const getCategoryColor = useCallback((status: string): StatusColorConfig => {
    const key = `category_${status}` as StatusColorKey
    return colors[key] || DEFAULT_STATUS_COLORS.category_applicant
  }, [colors])

  const getStatusStyle = useCallback((status: string, subStatus: string): React.CSSProperties => {
    const color = getStatusColor(status, subStatus)
    return {
      backgroundColor: color.bg,
      color: color.text,
    }
  }, [getStatusColor])

  const getCategoryStyle = useCallback((status: string): React.CSSProperties => {
    const color = getCategoryColor(status)
    return {
      backgroundColor: color.bg,
      color: color.text,
    }
  }, [getCategoryColor])

  // For cases where you need class-like syntax (returns empty string, use with style prop)
  const getStatusClasses = useCallback((_status: string, _subStatus: string): string => {
    // This returns empty since we use inline styles now
    // Kept for API compatibility if needed
    return ''
  }, [])

  const value = useMemo(() => ({
    colors,
    loading,
    getStatusColor,
    getCategoryColor,
    getStatusStyle,
    getCategoryStyle,
    getStatusClasses,
    refreshColors: fetchColors,
  }), [colors, loading, getStatusColor, getCategoryColor, getStatusStyle, getCategoryStyle, getStatusClasses, fetchColors])

  return (
    <StatusColorsContext.Provider value={value}>
      {children}
    </StatusColorsContext.Provider>
  )
}

/**
 * Hook to access status colors throughout the app
 * @throws Error if used outside StatusColorsProvider
 */
export function useStatusColors() {
  const context = useContext(StatusColorsContext)
  if (context === undefined) {
    throw new Error('useStatusColors must be used within a StatusColorsProvider')
  }
  return context
}

/**
 * Helper component for rendering a status badge with dynamic colors
 * Use this for consistent badge rendering across the app
 */
export function StatusBadge({
  status,
  subStatus,
  className = '',
}: {
  status: string
  subStatus: string
  className?: string
}) {
  const { getStatusStyle, getStatusColor } = useStatusColors()

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={getStatusStyle(status, subStatus)}
    >
      {getStatusColor(status, subStatus).label}
    </span>
  )
}

/**
 * Helper component for rendering a category badge (Applicant/Camper/Inactive)
 */
export function CategoryBadge({
  status,
  className = '',
}: {
  status: string
  className?: string
}) {
  const { getCategoryStyle, getCategoryColor } = useStatusColors()

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={getCategoryStyle(status)}
    >
      {getCategoryColor(status).label}
    </span>
  )
}
