/**
 * RoleBanner - Visual indicator for admin/super admin mode
 *
 * Displays a prominent banner at the top of the page to clearly indicate
 * when a user is operating in admin or super admin mode.
 * Only visible to admin and super_admin roles.
 */

'use client'

import { useAuth } from '@/lib/contexts/AuthContext'
import { Shield, Crown, Trees } from 'lucide-react'

export function RoleBanner() {
  const { user } = useAuth()

  // Only show for admin and super_admin roles
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null
  }

  const isSuperAdmin = user.role === 'super_admin'

  return (
    <div
      className={`
        relative overflow-hidden
        ${isSuperAdmin
          ? 'bg-gradient-to-r from-violet-900 via-purple-800 to-indigo-900'
          : 'bg-gradient-to-r from-camp-green via-emerald-700 to-camp-green'
        }
      `}
    >
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="role-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              {isSuperAdmin ? (
                // Diamond/gem pattern for super admin
                <path d="M20 0L40 20L20 40L0 20Z" fill="currentColor" className="text-white" />
              ) : (
                // Tree/forest pattern for admin
                <path d="M20 5L25 15H15L20 5ZM20 12L27 25H13L20 12ZM17 25H23V30H17V25Z" fill="currentColor" className="text-white" />
              )}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#role-pattern)" />
        </svg>
      </div>

      {/* Shimmer effect */}
      <div
        className={`
          absolute inset-0 opacity-20
          bg-gradient-to-r from-transparent via-white to-transparent
          animate-shimmer
        `}
        style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div className="relative z-10 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          {/* Icon */}
          <div className={`
            flex items-center justify-center w-6 h-6 rounded-full
            ${isSuperAdmin
              ? 'bg-amber-400/20 text-amber-300'
              : 'bg-emerald-400/20 text-emerald-300'
            }
          `}>
            {isSuperAdmin ? (
              <Crown className="w-3.5 h-3.5" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Text */}
          <div className="flex items-center gap-2">
            <span className={`
              text-xs font-bold tracking-wider uppercase
              ${isSuperAdmin ? 'text-amber-200' : 'text-emerald-200'}
            `}>
              {isSuperAdmin ? 'Super Admin Mode' : 'Admin Mode'}
            </span>

            {/* Decorative separator */}
            <span className="text-white/30">•</span>

            {/* Team indicator for admins */}
            {!isSuperAdmin && user.team && (
              <span className="text-xs text-white/70 capitalize">
                {user.team} Team
              </span>
            )}

            {/* Full access indicator for super admins */}
            {isSuperAdmin && (
              <span className="text-xs text-white/70">
                Full System Access
              </span>
            )}
          </div>

          {/* Decorative trees for admin */}
          {!isSuperAdmin && (
            <div className="hidden sm:flex items-center gap-1 ml-2 text-emerald-400/40">
              <Trees className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom border accent */}
      <div className={`
        absolute bottom-0 left-0 right-0 h-px
        ${isSuperAdmin
          ? 'bg-gradient-to-r from-transparent via-amber-400/50 to-transparent'
          : 'bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent'
        }
      `} />

      {/* Inline keyframe for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
