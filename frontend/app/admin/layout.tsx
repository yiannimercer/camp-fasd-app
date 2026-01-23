'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import Link from 'next/link'
import { Home, ClipboardList, LucideIcon } from 'lucide-react'
import { AppHeader } from '@/components/shared/AppHeader'

// Navigation items for admin sidebar
const navigationItems: { name: string; href: string; icon: LucideIcon; description: string }[] = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: Home,
    description: 'Overview & stats',
  },
  {
    name: 'Applications',
    href: '/admin/applications',
    icon: ClipboardList,
    description: 'Review applications',
  },
]

// Sidebar navigation component with active state detection
function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {navigationItems.map((item) => {
        // Exact match for /admin, startsWith for subpages
        const isActive = item.href === '/admin'
          ? pathname === '/admin'
          : pathname?.startsWith(item.href)
        const IconComponent = item.icon

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`
              flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all
              ${isActive
                ? 'bg-camp-green text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <IconComponent className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
            <div>
              <span className="block">{item.name}</span>
              <span className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                {item.description}
              </span>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}

// Mobile/Tablet horizontal navigation - shows below lg breakpoint
function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden border-b bg-white px-4 py-2">
      <div className="flex gap-2">
        {navigationItems.map((item) => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname?.startsWith(item.href)
          const IconComponent = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                ${isActive
                  ? 'bg-camp-green text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <IconComponent className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Role check: allow admin OR super_admin
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && user.role !== 'super_admin'))) {
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

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader currentView="admin" />

      {/* Mobile/Tablet Navigation - Shows below lg breakpoint */}
      <MobileNav />

      <div className="px-4 py-8">
        <div className="flex gap-6">
          {/* Side Navigation - Hidden below lg breakpoint */}
          {/* When viewing application details, the sections sidebar takes priority */}
          <div className="hidden lg:block w-52 flex-shrink-0">
            <div className="sticky top-24">
              <SidebarNav />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
