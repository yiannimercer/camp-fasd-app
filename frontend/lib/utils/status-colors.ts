/**
 * Status Color Utilities
 * Provides preset color palettes, validation, and accessibility helpers
 */

// Preset color palettes for quick selection in the UI
export const COLOR_PRESETS = {
  blue: { bg: '#DBEAFE', text: '#1E40AF' },
  indigo: { bg: '#E0E7FF', text: '#3730A3' },
  purple: { bg: '#F3E8FF', text: '#7C3AED' },
  pink: { bg: '#FCE7F3', text: '#BE185D' },
  red: { bg: '#FEE2E2', text: '#B91C1C' },
  orange: { bg: '#FFEDD5', text: '#C2410C' },
  amber: { bg: '#FEF3C7', text: '#B45309' },
  yellow: { bg: '#FEF9C3', text: '#A16207' },
  lime: { bg: '#ECFCCB', text: '#4D7C0F' },
  green: { bg: '#D1FAE5', text: '#065F46' },
  emerald: { bg: '#D1FAE5', text: '#047857' },
  teal: { bg: '#CCFBF1', text: '#0F766E' },
  cyan: { bg: '#CFFAFE', text: '#0E7490' },
  sky: { bg: '#E0F2FE', text: '#0369A1' },
  gray: { bg: '#F3F4F6', text: '#374151' },
  slate: { bg: '#F1F5F9', text: '#334155' },
} as const

export type PresetName = keyof typeof COLOR_PRESETS

// Get preset by name
export function getPreset(name: PresetName): { bg: string; text: string } {
  return COLOR_PRESETS[name]
}

// Get all preset names for iteration
export function getPresetNames(): PresetName[] {
  return Object.keys(COLOR_PRESETS) as PresetName[]
}

/**
 * Validate hex color format
 * @param color - Color string to validate
 * @returns true if valid hex color (#XXXXXX format)
 */
export function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

/**
 * Calculate relative luminance of a color
 * Used for contrast ratio calculation
 * @param hex - Hex color string
 * @returns Relative luminance value (0-1)
 */
function getLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16)
  const r = ((rgb >> 16) & 0xff) / 255
  const g = ((rgb >> 8) & 0xff) / 255
  const b = (rgb & 0xff) / 255

  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 * Based on WCAG 2.1 guidelines
 * @param hex1 - First hex color
 * @param hex2 - Second hex color
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1)
  const l2 = getLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast meets WCAG AA standard
 * @param bgColor - Background hex color
 * @param textColor - Text hex color
 * @returns true if contrast ratio >= 4.5:1 (WCAG AA for normal text)
 */
export function meetsContrastRequirement(bgColor: string, textColor: string): boolean {
  if (!isValidHex(bgColor) || !isValidHex(textColor)) return false
  return getContrastRatio(bgColor, textColor) >= 4.5
}

/**
 * Get contrast level label for UI display
 * @param bgColor - Background hex color
 * @param textColor - Text hex color
 * @returns Object with label and pass status
 */
export function getContrastLevel(bgColor: string, textColor: string): {
  ratio: number
  level: 'fail' | 'aa-large' | 'aa' | 'aaa'
  label: string
  pass: boolean
} {
  if (!isValidHex(bgColor) || !isValidHex(textColor)) {
    return { ratio: 0, level: 'fail', label: 'Invalid', pass: false }
  }

  const ratio = getContrastRatio(bgColor, textColor)

  if (ratio >= 7) {
    return { ratio, level: 'aaa', label: 'AAA', pass: true }
  } else if (ratio >= 4.5) {
    return { ratio, level: 'aa', label: 'AA', pass: true }
  } else if (ratio >= 3) {
    return { ratio, level: 'aa-large', label: 'AA Large', pass: true }
  } else {
    return { ratio, level: 'fail', label: 'Fail', pass: false }
  }
}

// Status configuration type
export interface StatusColorConfig {
  bg: string
  text: string
  label: string
}

// All status color keys
export type StatusColorKey =
  | 'applicant_not_started'
  | 'applicant_incomplete'
  | 'applicant_complete'
  | 'applicant_under_review'
  | 'applicant_waitlist'
  | 'camper_incomplete'
  | 'camper_complete'
  | 'inactive_withdrawn'
  | 'inactive_deferred'
  | 'inactive_inactive'
  | 'category_applicant'
  | 'category_camper'
  | 'category_inactive'

// Full status colors map type
export type StatusColorsMap = Record<StatusColorKey, StatusColorConfig>

// Status metadata for UI display
export const STATUS_METADATA: Record<StatusColorKey, { status: string; stage: string; description: string }> = {
  applicant_not_started: { status: 'Applicant', stage: 'Not Started', description: 'Application not yet begun' },
  applicant_incomplete: { status: 'Applicant', stage: 'Incomplete', description: 'Application in progress' },
  applicant_complete: { status: 'Applicant', stage: 'Complete', description: 'Application submitted, awaiting review' },
  applicant_under_review: { status: 'Applicant', stage: 'Under Review', description: 'Application being reviewed by team' },
  applicant_waitlist: { status: 'Applicant', stage: 'Waitlist', description: 'Application on waitlist' },
  camper_incomplete: { status: 'Camper', stage: 'Incomplete', description: 'Accepted camper, additional forms needed' },
  camper_complete: { status: 'Camper', stage: 'Complete', description: 'Accepted camper, all forms complete' },
  inactive_withdrawn: { status: 'Inactive', stage: 'Withdrawn', description: 'Family withdrew application' },
  inactive_deferred: { status: 'Inactive', stage: 'Deferred', description: 'Application deferred to next year' },
  inactive_inactive: { status: 'Inactive', stage: 'Deactivated', description: 'Application deactivated by admin' },
  category_applicant: { status: 'Category', stage: 'Applicant', description: 'Main status badge for applicants' },
  category_camper: { status: 'Category', stage: 'Camper', description: 'Main status badge for campers' },
  category_inactive: { status: 'Category', stage: 'Inactive', description: 'Main status badge for inactive' },
}

// Get all status keys for iteration
export function getStatusColorKeys(): StatusColorKey[] {
  return Object.keys(STATUS_METADATA) as StatusColorKey[]
}

// Get status keys grouped by type (stages vs categories)
export function getGroupedStatusKeys(): { stages: StatusColorKey[]; categories: StatusColorKey[] } {
  const all = getStatusColorKeys()
  return {
    stages: all.filter(k => !k.startsWith('category_')),
    categories: all.filter(k => k.startsWith('category_')),
  }
}
