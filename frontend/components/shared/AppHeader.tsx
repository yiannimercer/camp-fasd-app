'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, Shield, ClipboardCheck, Users, ChevronRight, Settings, User, ChevronDown } from 'lucide-react'

type ViewType = 'super-admin' | 'admin' | 'user'

interface AppHeaderProps {
  /** Which view/portal this header is for */
  currentView: ViewType
}

/**
 * Unified header component for consistent navigation across all portals
 *
 * Design principles:
 * - Consistent naming: "Super Admin", "Admin", "User" views
 * - Active view is highlighted, other views are navigation options
 * - Role-based visibility (super_admin sees all, admin sees admin+user, user sees user only)
 * - User dropdown with settings and sign out
 */
export function AppHeader({ currentView }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setIsDropdownOpen(false)
    await logout()
    router.push('/login')
  }

  if (!user) return null

  const isSuperAdmin = user.role === 'super_admin'
  const isAdmin = user.role === 'admin' || user.role === 'super_admin'

  // View configuration
  const views: { key: ViewType; label: string; href: string; icon: typeof Shield; requiredRole: 'super_admin' | 'admin' | 'user' }[] = [
    { key: 'super-admin', label: 'Super Admin', href: '/super-admin', icon: Shield, requiredRole: 'super_admin' },
    { key: 'admin', label: 'Admin', href: '/admin', icon: ClipboardCheck, requiredRole: 'admin' },
    { key: 'user', label: 'User', href: '/dashboard', icon: Users, requiredRole: 'user' },
  ]

  // Filter views based on user role
  const availableViews = views.filter(view => {
    if (view.requiredRole === 'super_admin') return isSuperAdmin
    if (view.requiredRole === 'admin') return isAdmin
    return true // User view available to all
  })

  // Get current view label for badge
  const currentViewConfig = views.find(v => v.key === currentView)

  // Get user initials for avatar
  const getInitials = () => {
    const first = user.first_name?.charAt(0) || ''
    const last = user.last_name?.charAt(0) || ''
    return (first + last).toUpperCase() || user.email.charAt(0).toUpperCase()
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo & Current View Indicator */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center group">
              <Image
                src="/2019-CAMP-Logo-Transparent.png"
                alt="CAMP - A FASD Community"
                width={140}
                height={56}
                className="object-contain h-12 w-auto"
                priority
              />
            </Link>

            {/* Current View Badge */}
            {currentViewConfig && (
              <div className="hidden sm:flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-gray-300" />
                <span className={`
                  px-3 py-1 rounded-full text-sm font-medium
                  ${currentView === 'super-admin'
                    ? 'bg-purple-100 text-purple-700'
                    : currentView === 'admin'
                    ? 'bg-camp-green/10 text-camp-green'
                    : 'bg-camp-orange/10 text-camp-orange'
                  }
                `}>
                  {currentViewConfig.label}
                </span>
              </div>
            )}
          </div>

          {/* Right: Navigation + User Dropdown */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* View Switcher - Only show other available views */}
            {availableViews.length > 1 && (
              <nav className="hidden sm:flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                {availableViews.map((view, idx) => {
                  const isActive = view.key === currentView
                  const Icon = view.icon

                  return (
                    <button
                      key={view.key}
                      onClick={() => router.push(view.href)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all
                        ${idx > 0 ? 'border-l border-gray-200' : ''}
                        ${isActive
                          ? 'bg-camp-green text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{view.label}</span>
                    </button>
                  )
                })}
              </nav>
            )}

            {/* Mobile View Switcher Dropdown */}
            {availableViews.length > 1 && (
              <div className="sm:hidden">
                <select
                  value={currentView}
                  onChange={(e) => {
                    const selected = availableViews.find(v => v.key === e.target.value)
                    if (selected) router.push(selected.href)
                  }}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  {availableViews.map(view => (
                    <option key={view.key} value={view.key}>{view.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-gray-200" />

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-camp-green to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                  {getInitials()}
                </div>

                {/* Name (desktop) */}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-camp-charcoal leading-tight">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize leading-tight">
                    {user.role?.replace('_', ' ')}
                  </p>
                </div>

                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {/* User Info (mobile) */}
                  <div className="sm:hidden px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-camp-charcoal">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>

                  {/* Menu Items */}
                  <Link
                    href="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    Account Settings
                  </Link>

                  <div className="border-t border-gray-100 my-1" />

                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
