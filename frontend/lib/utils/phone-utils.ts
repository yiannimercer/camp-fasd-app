/**
 * Phone Number Utilities
 * Provides formatting and validation for US phone numbers
 *
 * Format: (123) 456-7890
 */

/**
 * Format a phone number to (XXX) XXX-XXXX format
 *
 * Handles various input formats:
 * - 1234567890
 * - 123-456-7890
 * - (123) 456-7890
 * - 123.456.7890
 * - +1 123 456 7890
 *
 * @param phone - Raw phone number string
 * @returns Formatted phone number or original if invalid
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Handle US numbers with country code
  const normalizedDigits = digits.startsWith('1') && digits.length === 11
    ? digits.slice(1)
    : digits

  // Only format if we have exactly 10 digits
  if (normalizedDigits.length === 10) {
    const areaCode = normalizedDigits.slice(0, 3)
    const middle = normalizedDigits.slice(3, 6)
    const last = normalizedDigits.slice(6)
    return `(${areaCode}) ${middle}-${last}`
  }

  // Return original if not a valid US phone number
  return phone
}

/**
 * Format phone number as user types (for input fields)
 * Provides real-time formatting feedback
 *
 * @param value - Current input value
 * @returns Formatted value for display
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')

  // Handle US numbers with country code
  const normalizedDigits = digits.startsWith('1') && digits.length > 10
    ? digits.slice(1)
    : digits

  // Format progressively based on length
  if (normalizedDigits.length === 0) {
    return ''
  } else if (normalizedDigits.length <= 3) {
    return `(${normalizedDigits}`
  } else if (normalizedDigits.length <= 6) {
    return `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3)}`
  } else {
    return `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6, 10)}`
  }
}

/**
 * Get raw digits from a formatted phone number
 * Useful for saving to database
 *
 * @param phone - Formatted phone number
 * @returns Raw digits only
 */
export function getPhoneDigits(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Validate if a phone number is valid US format (10 digits)
 *
 * @param phone - Phone number to validate
 * @returns true if valid US phone number
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  // Allow 10 digits or 11 digits starting with 1
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

/**
 * React hook-friendly phone input handler
 * Returns formatted value and handles input masking
 *
 * Usage:
 * const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *   setPhone(handlePhoneInputChange(e.target.value))
 * }
 */
export function handlePhoneInputChange(value: string): string {
  return formatPhoneInput(value)
}
