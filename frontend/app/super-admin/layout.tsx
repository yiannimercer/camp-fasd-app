'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import Link from 'next/link'
import { Home, Users, UsersRound, FileEdit, Settings, Mail, ClipboardList, ClipboardCheck, LucideIcon } from 'lucide-react'

// Navigation items defined outside component to prevent recreation
const navigationItems: { name: string; href: string; icon: LucideIcon; section: string }[] = [
  {
    name: 'Overview',
    href: '/super-admin',
    icon: Home,
    section: 'dashboard',
  },
  {
    name: 'Review Applications',
    href: '/admin/applications',
    icon: ClipboardCheck,
    section: 'review',
  },
  {
    name: 'User Management',
    href: '/super-admin/users',
    icon: Users,
    section: 'users',
  },
  {
    name: 'Teams',
    href: '/super-admin/teams',
    icon: UsersRound,
    section: 'teams',
  },
  {
    name: 'Application Builder',
    href: '/super-admin/application-builder',
    icon: FileEdit,
    section: 'builder',
  },
  {
    name: 'System Configuration',
    href: '/super-admin/settings',
    icon: Settings,
    section: 'settings',
  },
  {
    name: 'Email Templates',
    href: '/super-admin/email-templates',
    icon: Mail,
    section: 'email',
  },
  {
    name: 'Audit Logs',
    href: '/super-admin/audit-logs',
    icon: ClipboardList,
    section: 'audit',
  },
]

// Separate component for sidebar navigation to ensure it re-renders on pathname changes
function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {navigationItems.map((item) => {
        // Check for exact match OR if we're on a subpage of this route
        const isActive = pathname === item.href ||
          (item.href !== '/super-admin' && pathname?.startsWith(item.href + '/'))
        const IconComponent = item.icon
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`
              flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
              ${isActive
                ? 'bg-camp-green text-white'
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <IconComponent className="mr-3 h-5 w-5" />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  const handleSignOut = async () => {
    await logout()
    router.push('/login')
  }

  useEffect(() => {
    if (!loading && (!user || user.role !== 'super_admin')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-camp-green border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'super_admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-camp-green">CAMP FASD</h1>
              </div>
              <div className="ml-10">
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                  Super Admin
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/applications"
                className="text-sm text-gray-600 hover:text-camp-green"
              >
                Admin Dashboard
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-camp-green"
              >
                User Dashboard
              </Link>
              <div className="text-sm text-gray-700">
                {user.first_name} {user.last_name}
              </div>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-red-600 font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Side Navigation */}
          <div className="w-64 flex-shrink-0">
            <SidebarNav />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
