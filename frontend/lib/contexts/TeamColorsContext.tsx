'use client'

/**
 * TeamColorsContext
 *
 * Provides team color configuration throughout the application.
 * Fetches team data on mount and exposes utility functions for getting
 * team colors by key.
 *
 * Usage:
 * - Wrap app with <TeamColorsProvider>
 * - Use useTeamColors() hook to access team colors
 * - getTeamColor(key) returns { bg, text } for styling badges
 * - getTeamStyle(key) returns CSS properties for inline styling
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Team color configuration
interface TeamColor {
  key: string
  name: string
  color: string // hex value
}

interface TeamColorsContextType {
  teams: TeamColor[]
  loading: boolean
  getTeamColor: (teamKey: string | null | undefined) => { bg: string; text: string; name: string }
  getTeamStyle: (teamKey: string | null | undefined) => React.CSSProperties
  refreshTeams: () => Promise<void>
}

// Default fallback color for unknown teams
const DEFAULT_TEAM_COLOR = {
  bg: '#6B7280',
  text: '#FFFFFF',
  name: 'Unknown'
}

// Calculate contrasting text color (white or black) based on background
function getContrastingTextColor(hexBg: string): string {
  // Remove # if present
  const hex = hexBg.replace('#', '')

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return white for dark backgrounds, dark color for light backgrounds
  return luminance > 0.5 ? '#1F2937' : '#FFFFFF'
}

const TeamColorsContext = createContext<TeamColorsContextType | undefined>(undefined)

export function TeamColorsProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<TeamColor[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch teams from public API endpoint (no auth required)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/public/teams`)

      if (response.ok) {
        const data = await response.json()
        setTeams(data.map((t: { key: string; name: string; color: string }) => ({
          key: t.key,
          name: t.name,
          color: t.color
        })))
      } else {
        // Fallback to hardcoded defaults if API fails
        console.warn('Failed to fetch teams, using defaults')
        setTeams([
          { key: 'ops', name: 'Operations', color: '#3B82F6' },
          { key: 'medical', name: 'Medical', color: '#10B981' },
          { key: 'behavioral', name: 'Behavioral Health', color: '#8B5CF6' },
        ])
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
      // Use defaults on error
      setTeams([
        { key: 'ops', name: 'Operations', color: '#3B82F6' },
        { key: 'medical', name: 'Medical', color: '#10B981' },
        { key: 'behavioral', name: 'Behavioral Health', color: '#8B5CF6' },
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  // Get team color by key
  const getTeamColor = useCallback((teamKey: string | null | undefined) => {
    if (!teamKey) return DEFAULT_TEAM_COLOR

    const team = teams.find(t => t.key === teamKey)
    if (!team) return { ...DEFAULT_TEAM_COLOR, name: teamKey }

    return {
      bg: team.color,
      text: getContrastingTextColor(team.color),
      name: team.name
    }
  }, [teams])

  // Get inline style object for team color
  const getTeamStyle = useCallback((teamKey: string | null | undefined): React.CSSProperties => {
    const color = getTeamColor(teamKey)
    return {
      backgroundColor: color.bg,
      color: color.text
    }
  }, [getTeamColor])

  return (
    <TeamColorsContext.Provider
      value={{
        teams,
        loading,
        getTeamColor,
        getTeamStyle,
        refreshTeams: fetchTeams
      }}
    >
      {children}
    </TeamColorsContext.Provider>
  )
}

export function useTeamColors() {
  const context = useContext(TeamColorsContext)
  if (!context) {
    throw new Error('useTeamColors must be used within a TeamColorsProvider')
  }
  return context
}
