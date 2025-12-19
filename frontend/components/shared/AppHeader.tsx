'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, Shield, ClipboardCheck, Users, TreePine, ChevronRight } from 'lucide-react'

type ViewType = 'super-admin' | 'admin' | 'family'

interface AppHeaderProps {
  /** Which view/portal this header is for */
  currentView: ViewType
}

/**
 * Unified header component for consistent navigation across all portals
 *
 * Design principles:
 * - Consistent naming: "Super Admin", "Admin", "Family" views
 * - Active view is highlighted, other views are navigation options
 * - Role-based visibility (super_admin sees all, admin sees admin+family, family sees family only)
 */
export function AppHeader({ currentView }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const handleSignOut = async () => {
    await logout()
    router.push('/login')
  }

  if (!user) return null

  const isSuperAdmin = user.role === 'super_admin'
  const isAdmin = user.role === 'admin' || user.role === 'super_admin'

  // View configuration
  const views: { key: ViewType; label: string; href: string; icon: typeof Shield; requiredRole: 'super_admin' | 'admin' | 'family' }[] = [
    { key: 'super-admin', label: 'Super Admin', href: '/super-admin', icon: Shield, requiredRole: 'super_admin' },
    { key: 'admin', label: 'Admin', href: '/admin/applications', icon: ClipboardCheck, requiredRole: 'admin' },
    { key: 'family', label: 'Family', href: '/dashboard', icon: Users, requiredRole: 'family' },
  ]

  // Filter views based on user role
  const availableViews = views.filter(view => {
    if (view.requiredRole === 'super_admin') return isSuperAdmin
    if (view.requiredRole === 'admin') return isAdmin
    return true // Family view available to all
  })

  // Get current view label for badge
  const currentViewConfig = views.find(v => v.key === currentView)

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

          {/* Right: Navigation + User Info + Sign Out */}
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

            {/* User Info */}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-camp-charcoal">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role?.replace('_', ' ')}
              </p>
            </div>

            {/* Sign Out Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 text-gray-600 hover:text-red-600 hover:border-red-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
