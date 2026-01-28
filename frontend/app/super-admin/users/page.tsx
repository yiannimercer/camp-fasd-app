'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useTeamColors } from '@/lib/contexts/TeamColorsContext'
import { useToast } from '@/components/shared/ToastNotification'
import {
  getAllUsers, changeUserRole, suspendUser, updateUser,
  deleteUser, resetUserPassword, createUser, resendInvitation, sendDirectEmail,
  getAllTeams,
  type UserWithDetails, type Team, type CreateUserRequest, type DirectEmailRequest
} from '@/lib/api-super-admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/shared/ConfirmationModal'
import { formatPhoneNumber, formatPhoneInput } from '@/lib/utils/phone-utils'
import {
  Users, UserPlus, MoreVertical, Edit, Trash2, KeyRound, Mail,
  RefreshCcw, UserX, UserCheck, ChevronDown, X, AlertTriangle, Send, Loader2
} from 'lucide-react'

// Format relative time for last login display
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`

  // For older dates, show abbreviated date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function UsersManagementPage() {
  const { token } = useAuth()
  const { getTeamColor, getTeamStyle } = useTeamColors()
  const toast = useToast()
  const [users, setUsers] = useState<UserWithDetails[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [teamFilter, setTeamFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25 // Users per page

  // Actions dropdown
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null)
  const [editFormData, setEditFormData] = useState<{
    first_name: string
    last_name: string
    email: string
    phone: string
    role: string
    team: string
    status: string
    receive_emails: boolean
  }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'user',
    team: '',
    status: 'active',
    receive_emails: true
  })
  const [saving, setSaving] = useState(false)

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createFormData, setCreateFormData] = useState<CreateUserRequest>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'user',
    team: '',
    send_invitation: true
  })
  const [creating, setCreating] = useState(false)

  // Direct email modal state
  const [emailingUser, setEmailingUser] = useState<UserWithDetails | null>(null)
  const [emailFormData, setEmailFormData] = useState<DirectEmailRequest>({
    subject: '',
    message: '',
    include_greeting: true
  })
  const [sendingEmail, setSendingEmail] = useState(false)

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    type: 'role' | 'suspend' | 'activate' | 'delete' | 'reset_password' | 'resend_invite' | null
    user: UserWithDetails | null
    newRole?: string
    team?: string
  }>({ type: null, user: null })
  const [suspendReason, setSuspendReason] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!token) return
    loadData()
  }, [token])

  const loadData = async () => {
    if (!token) return

    try {
      setLoading(true)
      const [usersData, teamsData] = await Promise.all([
        getAllUsers(token, {
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          team: teamFilter || undefined,
          search: searchTerm || undefined,
          limit: 1000,  // Load all users (backend max is typically 1000)
        }),
        getAllTeams(token)
      ])
      setUsers(usersData)
      setTeams(teamsData)
      setError(null)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  // Reload when filters change and reset pagination
  useEffect(() => {
    if (!token) return
    setCurrentPage(1)  // Reset to first page when filters change
    loadData()
  }, [roleFilter, statusFilter, teamFilter, searchTerm])

  const handleEditUser = (user: UserWithDetails) => {
    setEditingUser(user)
    setEditFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email,
      phone: formatPhoneNumber(user.phone),
      role: user.role,
      team: user.team || '',
      status: user.status || 'active',
      receive_emails: user.receive_emails ?? true
    })
    setOpenDropdown(null)
  }

  const handleSaveUser = async () => {
    if (!token || !editingUser) return

    try {
      setSaving(true)
      // Extract just the digits from formatted phone
      const phoneDigits = editFormData.phone.replace(/\D/g, '')
      await updateUser(token, editingUser.id, {
        ...editFormData,
        phone: phoneDigits
      })
      setEditingUser(null)
      toast.success('User updated successfully')
      loadData()
    } catch (err) {
      console.error('Failed to update user:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateUser = async () => {
    if (!token) return

    if (!createFormData.email) {
      toast.warning('Email is required')
      return
    }

    if (createFormData.role === 'admin' && !createFormData.team) {
      toast.warning('Team is required for admin role')
      return
    }

    try {
      setCreating(true)
      const phoneDigits = createFormData.phone?.replace(/\D/g, '') || ''
      await createUser(token, {
        ...createFormData,
        phone: phoneDigits || undefined
      })
      setShowCreateModal(false)
      setCreateFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: 'user',
        team: '',
        send_invitation: true
      })
      toast.success('User created and invitation sent!')
      loadData()
    } catch (err) {
      console.error('Failed to create user:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const handleSendEmail = async () => {
    if (!token || !emailingUser) return

    if (!emailFormData.subject || !emailFormData.message) {
      toast.warning('Subject and message are required')
      return
    }

    try {
      setSendingEmail(true)
      await sendDirectEmail(token, emailingUser.id, emailFormData)
      setEmailingUser(null)
      setEmailFormData({ subject: '', message: '', include_greeting: true })
      toast.success('Email sent successfully!')
    } catch (err) {
      console.error('Failed to send email:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  // Execute actions after confirmation
  const executeAction = async () => {
    if (!token || !confirmModal.user) return

    setConfirmLoading(true)
    try {
      switch (confirmModal.type) {
        case 'suspend':
          if (!suspendReason.trim()) {
            toast.warning('Please provide a reason for suspension')
            setConfirmLoading(false)
            return
          }
          await suspendUser(token, confirmModal.user.id, 'suspended', suspendReason)
          toast.success('User suspended successfully')
          break

        case 'activate':
          await suspendUser(token, confirmModal.user.id, 'active')
          toast.success('User activated successfully')
          break

        case 'delete':
          await deleteUser(token, confirmModal.user.id)
          toast.success('User deleted successfully')
          break

        case 'reset_password':
          await resetUserPassword(token, confirmModal.user.id)
          toast.success('Password reset email sent')
          break

        case 'resend_invite':
          await resendInvitation(token, confirmModal.user.id)
          toast.success('Invitation email resent')
          break

        case 'role':
          if (confirmModal.newRole) {
            await changeUserRole(token, confirmModal.user.id, confirmModal.newRole, confirmModal.team)
            toast.success('Role changed successfully')
          }
          break
      }

      setConfirmModal({ type: null, user: null })
      setSuspendReason('')
      loadData()
    } catch (err) {
      console.error('Action failed:', err)
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setConfirmLoading(false)
    }
  }

  // Compact role badge styling
  const getRoleBadgeStyles = (role: string): { className: string; style?: React.CSSProperties } => {
    const baseClass = 'px-2 py-0.5 inline-flex items-center text-[10px] font-bold rounded tracking-wide uppercase border'
    switch (role) {
      case 'super_admin':
        return {
          className: baseClass,
          style: {
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            color: '#92400E',
            borderColor: '#F59E0B',
          }
        }
      case 'admin':
        return {
          className: `${baseClass} bg-blue-50 text-blue-700 border-blue-200`
        }
      case 'user':
        return {
          className: `${baseClass} bg-gray-100 text-gray-600 border-gray-300`
        }
      default:
        return {
          className: `${baseClass} bg-gray-100 text-gray-600 border-gray-300`
        }
    }
  }

  // Get role display text (abbreviated for super_admin)
  const getRoleDisplayText = (role: string): string => {
    switch (role) {
      case 'super_admin': return 'SUPER'
      case 'admin': return 'ADMIN'
      case 'user': return 'USER'
      default: return role.toUpperCase()
    }
  }

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'suspended': return 'bg-red-100 text-red-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      default: return 'bg-green-100 text-green-800'
    }
  }


  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-camp-green border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage all users, roles, and permissions
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{users.length}</div>
                <div className="text-sm text-gray-600">Total Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {users.filter(u => u.role === 'user').length}
            </div>
            <div className="text-sm text-gray-600">Families</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.role === 'admin').length}
            </div>
            <div className="text-sm text-gray-600">Admins</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">
              {users.filter(u => u.role === 'super_admin').length}
            </div>
            <div className="text-sm text-gray-600">Super Admins</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-camp-green"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-camp-green"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-camp-green"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Team Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team
              </label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-camp-green"
              >
                <option value="">All Teams</option>
                {teams.map(team => (
                  <option key={team.key} value={team.key}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>

          {(roleFilter || statusFilter || teamFilter || searchTerm) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRoleFilter('')
                  setStatusFilter('')
                  setTeamFilter('')
                  setSearchTerm('')
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Users Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 table-fixed min-w-[850px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[15%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Camper
                  </th>
                  <th className="w-[18%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="w-[15%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role / Team
                  </th>
                  <th className="w-[8%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="w-[10%] px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user.first_name} {user.last_name}
                      </div>
                      {user.phone && (
                        <div className="text-xs text-gray-500">{formatPhoneNumber(user.phone)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {user.camper_name ? (
                        <div className="text-sm text-gray-900 truncate" title={user.camper_name}>
                          {user.camper_name}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-gray-900 truncate" title={user.email}>
                        {user.email}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {(() => {
                          const badgeStyles = getRoleBadgeStyles(user.role)
                          return (
                            <span className={badgeStyles.className} style={badgeStyles.style}>
                              {getRoleDisplayText(user.role)}
                            </span>
                          )
                        })()}
                        {user.team && (
                          <span
                            className="px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded truncate"
                            style={getTeamStyle(user.team)}
                          >
                            {getTeamColor(user.team).name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full ${getStatusBadgeColor(user.status)}`}>
                        {user.status || 'active'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {user.last_login ? (
                        <span title={new Date(user.last_login).toLocaleString()}>
                          {formatRelativeTime(user.last_login)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Never</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="relative inline-block" ref={openDropdown === user.id ? dropdownRef : null}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-500" />
                        </button>

                        {/* Actions Dropdown */}
                        {openDropdown === user.id && (
                          <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit User
                            </button>

                            <button
                              onClick={() => {
                                setEmailingUser(user)
                                setOpenDropdown(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Mail className="h-4 w-4" />
                              Send Email
                            </button>

                            <button
                              onClick={() => {
                                setConfirmModal({ type: 'reset_password', user })
                                setOpenDropdown(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <KeyRound className="h-4 w-4" />
                              Reset Password
                            </button>

                            <button
                              onClick={() => {
                                setConfirmModal({ type: 'resend_invite', user })
                                setOpenDropdown(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              Resend Invitation
                            </button>

                            <hr className="my-1" />

                            {(user.status === 'active' || !user.status) ? (
                              <button
                                onClick={() => {
                                  setConfirmModal({ type: 'suspend', user })
                                  setOpenDropdown(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                              >
                                <UserX className="h-4 w-4" />
                                Suspend User
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setConfirmModal({ type: 'activate', user })
                                  setOpenDropdown(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                              >
                                <UserCheck className="h-4 w-4" />
                                Activate User
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setConfirmModal({ type: 'delete', user })
                                setOpenDropdown(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {users.length > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, users.length)} of {users.length} users
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(users.length / pageSize)) }, (_, i) => {
                    const totalPages = Math.ceil(users.length / pageSize)
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 text-sm font-medium rounded-lg ${
                          currentPage === pageNum
                            ? 'bg-camp-green text-white'
                            : 'bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(users.length / pageSize), p + 1))}
                  disabled={currentPage === Math.ceil(users.length / pageSize)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {users.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: formatPhoneInput(e.target.value) })}
                  placeholder="(123) 456-7890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {/* Team (for admins and super admins) */}
              {(editFormData.role === 'admin' || editFormData.role === 'super_admin') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team {editFormData.role === 'admin' && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={editFormData.team}
                    onChange={(e) => setEditFormData({ ...editFormData, team: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                  >
                    <option value="">No Team</option>
                    {teams.map(team => (
                      <option key={team.key} value={team.key}>{team.name}</option>
                    ))}
                  </select>
                  {editFormData.role === 'super_admin' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Optional for super admins. Assigning a team allows your actions to be tracked by team.
                    </p>
                  )}
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Email Preferences Toggle */}
              <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Receive Emails
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automated emails like digests, reminders, and notifications
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditFormData({
                    ...editFormData,
                    receive_emails: !editFormData.receive_emails
                  })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-camp-green focus:ring-offset-2 ${
                    editFormData.receive_emails ? 'bg-camp-green' : 'bg-gray-300'
                  }`}
                  role="switch"
                  aria-checked={editFormData.receive_emails}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      editFormData.receive_emails ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => setEditingUser(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveUser}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-camp-green to-camp-green/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <UserPlus className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Add New User</h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                />
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={createFormData.first_name || ''}
                    onChange={(e) => setCreateFormData({ ...createFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={createFormData.last_name || ''}
                    onChange={(e) => setCreateFormData({ ...createFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={createFormData.phone || ''}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: formatPhoneInput(e.target.value) })}
                  placeholder="(123) 456-7890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={createFormData.role}
                  onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                >
                  <option value="user">User (Family)</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {/* Team (for admins and super admins) */}
              {(createFormData.role === 'admin' || createFormData.role === 'super_admin') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team {createFormData.role === 'admin' && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={createFormData.team || ''}
                    onChange={(e) => setCreateFormData({ ...createFormData, team: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-camp-green"
                  >
                    <option value="">{createFormData.role === 'admin' ? 'Select Team' : 'No Team (Optional)'}</option>
                    {teams.map(team => (
                      <option key={team.key} value={team.key}>{team.name}</option>
                    ))}
                  </select>
                  {createFormData.role === 'super_admin' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Optional. Assigning a team allows actions to be tracked by team.
                    </p>
                  )}
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> An invitation email will be sent to this user. They will need to click the link in the email to set their password and complete registration.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateUser}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create & Send Invitation
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {emailingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Send Email</h2>
                    <p className="text-sm text-white/80">
                      To: {emailingUser.first_name} {emailingUser.last_name} ({emailingUser.email})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEmailingUser(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={emailFormData.subject}
                  onChange={(e) => setEmailFormData({ ...emailFormData, subject: e.target.value })}
                  placeholder="Enter email subject..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={emailFormData.message}
                  onChange={(e) => setEmailFormData({ ...emailFormData, message: e.target.value })}
                  placeholder="Type your message here..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Include Greeting Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="include-greeting"
                  checked={emailFormData.include_greeting}
                  onChange={(e) => setEmailFormData({ ...emailFormData, include_greeting: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="include-greeting" className="text-sm text-gray-700">
                  Include greeting ("Dear {emailingUser.first_name || 'Friend'},")
                </label>
              </div>

              {/* Info Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-600">
                  This email will be sent with CAMP's branded template including logo, headers, and footer.
                  Replies will go to your email ({emailingUser.email}).
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => setEmailingUser(null)}
                disabled={sendingEmail}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend User Modal */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'suspend'}
        onClose={() => {
          setConfirmModal({ type: null, user: null })
          setSuspendReason('')
        }}
        onConfirm={executeAction}
        title="Suspend User"
        message={
          <>
            Are you sure you want to suspend{' '}
            <span className="font-semibold">
              {confirmModal.user?.first_name} {confirmModal.user?.last_name}
            </span>?
            <div className="mt-3 p-3 bg-red-50 rounded-lg text-xs text-red-800">
              <p><strong>Warning:</strong> Suspended users will be completely blocked from logging in to the application. This action affects both our database and Supabase Auth.</p>
            </div>
          </>
        }
        confirmLabel="Suspend User"
        theme="danger"
        isLoading={confirmLoading}
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for suspension <span className="text-red-500">*</span>
          </label>
          <textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Enter reason for suspension..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm resize-none"
            rows={3}
          />
        </div>
      </ConfirmationModal>

      {/* Activate User Modal */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'activate'}
        onClose={() => setConfirmModal({ type: null, user: null })}
        onConfirm={executeAction}
        title="Activate User"
        message={
          <>
            Are you sure you want to activate{' '}
            <span className="font-semibold">
              {confirmModal.user?.first_name} {confirmModal.user?.last_name}
            </span>?
            <div className="mt-3 p-3 bg-green-50 rounded-lg text-xs text-green-800">
              <p>This user will regain access to log in and use the application.</p>
            </div>
          </>
        }
        confirmLabel="Activate User"
        theme="success"
        isLoading={confirmLoading}
      />

      {/* Delete User Modal */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'delete'}
        onClose={() => setConfirmModal({ type: null, user: null })}
        onConfirm={executeAction}
        title="Delete User"
        message={
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-red-900">This action is permanent and cannot be undone!</p>
              </div>
            </div>
            <p className="mb-3">
              Are you sure you want to delete{' '}
              <span className="font-semibold">
                {confirmModal.user?.first_name} {confirmModal.user?.last_name}
              </span> ({confirmModal.user?.email})?
            </p>
            <div className="p-3 bg-red-50 rounded-lg text-xs text-red-800 space-y-1">
              <p><strong>This will permanently delete:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>User account from Supabase Auth</li>
                <li>All applications and responses</li>
                <li>All uploaded files and documents</li>
                <li>All admin notes and history</li>
                <li>All related records and data</li>
              </ul>
            </div>
          </>
        }
        confirmLabel="Permanently Delete"
        theme="danger"
        isLoading={confirmLoading}
      />

      {/* Reset Password Modal */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'reset_password'}
        onClose={() => setConfirmModal({ type: null, user: null })}
        onConfirm={executeAction}
        title="Reset Password"
        message={
          <>
            Send a password reset email to{' '}
            <span className="font-semibold">
              {confirmModal.user?.first_name} {confirmModal.user?.last_name}
            </span>?
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
              <p>An email will be sent to <strong>{confirmModal.user?.email}</strong> with a link to reset their password.</p>
            </div>
          </>
        }
        confirmLabel="Send Reset Email"
        theme="info"
        isLoading={confirmLoading}
      />

      {/* Resend Invitation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.type === 'resend_invite'}
        onClose={() => setConfirmModal({ type: null, user: null })}
        onConfirm={executeAction}
        title="Resend Invitation"
        message={
          <>
            Resend the invitation email to{' '}
            <span className="font-semibold">
              {confirmModal.user?.first_name} {confirmModal.user?.last_name}
            </span>?
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
              <p>A new invitation email will be sent to <strong>{confirmModal.user?.email}</strong> with a link to complete their registration.</p>
            </div>
          </>
        }
        confirmLabel="Resend Invitation"
        theme="info"
        isLoading={confirmLoading}
      />
    </div>
  )
}
