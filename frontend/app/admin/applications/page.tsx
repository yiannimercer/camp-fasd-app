/**
 * Admin Applications List Page
 * View and filter all applications
 */

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getAllApplications, ApplicationWithUser } from '@/lib/api-admin'
import {
  acceptApplication,
  promoteToTier2,
  addToWaitlist,
  removeFromWaitlist,
  deferApplication,
  withdrawApplication,
  rejectApplication
} from '@/lib/api-admin-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateCST } from '@/lib/date-utils'
import { Hand, ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Clock, ArrowRightCircle, XCircle, CalendarX } from 'lucide-react'

// Sortable column keys
type SortColumn = 'applicant' | 'camper' | 'status' | 'progress' | 'approvals' | 'created' | null
type SortDirection = 'asc' | 'desc'

// Status order for sorting (lower = earlier in sort)
// Tier 1 statuses come first, then Tier 2, then Inactive
const STATUS_ORDER: Record<string, number> = {
  // Tier 1 (Applicant)
  'not_started': 1,
  'incomplete': 2,
  'in_progress': 2,  // Legacy alias for incomplete
  'complete': 3,
  'under_review': 4,
  'waitlist': 5,
  // Tier 2 (Camper)
  'tier2_incomplete': 6,
  'accepted': 6,  // Legacy alias for tier2_incomplete
  'unpaid': 7,
  'paid': 8,
  // Inactive
  'deferred': 9,
  'withdrawn': 10,
  'rejected': 11,
  'declined': 11,  // Legacy alias for rejected
}

// LocalStorage key for sort preference
const SORT_STORAGE_KEY = 'admin-applications-sort'

export default function AdminApplicationsPage() {
  const router = useRouter()
  const { token, user, logout } = useAuth()
  const [applications, setApplications] = useState<ApplicationWithUser[]>([])
  const [allApplications, setAllApplications] = useState<ApplicationWithUser[]>([]) // For stats (unfiltered)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Load sort preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY)
      if (saved) {
        const { column, direction } = JSON.parse(saved)
        if (column) setSortColumn(column)
        if (direction) setSortDirection(direction)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Save sort preference to localStorage when it changes
  useEffect(() => {
    try {
      if (sortColumn) {
        localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ column: sortColumn, direction: sortDirection }))
      } else {
        localStorage.removeItem(SORT_STORAGE_KEY)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [sortColumn, sortDirection])

  // Check if user is admin
  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/dashboard')
    }
  }, [user, router])

  // Load ALL applications once (for stats cards)
  useEffect(() => {
    if (!token) return

    const loadAllApplications = async () => {
      try {
        const data = await getAllApplications(token)
        setAllApplications(data)
      } catch (err) {
        console.error('Failed to load all applications for stats:', err)
      }
    }

    loadAllApplications()
  }, [token])

  // Load filtered applications (for table)
  useEffect(() => {
    if (!token) return

    const loadApplications = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
        setApplications(data)
      } catch (err) {
        console.error('Failed to load applications:', err)
        setError(err instanceof Error ? err.message : 'Failed to load applications')
      } finally {
        setLoading(false)
      }
    }

    loadApplications()
  }, [token, statusFilter, searchTerm])

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      // Tier 1 (Applicant)
      case 'not_started':
        return 'bg-gray-100 text-gray-800'
      case 'incomplete':
      case 'in_progress':  // Legacy
        return 'bg-blue-100 text-blue-800'
      case 'complete':
        return 'bg-indigo-100 text-indigo-800'
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'waitlist':
        return 'bg-orange-100 text-orange-800'
      // Tier 2 (Camper)
      case 'tier2_incomplete':
      case 'accepted':  // Legacy
        return 'bg-cyan-100 text-cyan-800'
      case 'unpaid':
        return 'bg-rose-100 text-rose-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      // Inactive
      case 'deferred':
        return 'bg-slate-100 text-slate-600'
      case 'withdrawn':
        return 'bg-gray-100 text-gray-500'
      case 'rejected':
      case 'declined':  // Legacy
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    // Custom display names for clearer status labels
    const statusDisplayNames: Record<string, string> = {
      'not_started': 'Not Started',
      'incomplete': 'In Progress',
      'in_progress': 'In Progress',
      'complete': 'Complete',
      'under_review': 'Under Review',
      'waitlist': 'Waitlist',
      'tier2_incomplete': 'Tier 2 - Incomplete',
      'accepted': 'Accepted',
      'unpaid': 'Awaiting Payment',
      'paid': 'Paid',
      'deferred': 'Deferred',
      'withdrawn': 'Withdrawn',
      'rejected': 'Rejected',
      'declined': 'Declined',
    }
    return statusDisplayNames[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  // Get tier badge for display
  const getTierBadge = (tier: number) => {
    if (tier === 2) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mr-2">Tier 2</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 mr-2">Tier 1</span>
  }

  const handlePromoteToTier2 = async (applicationId: string) => {
    if (!token) return

    if (!confirm('Are you sure you want to promote this application to Tier 2? This will notify the family and enable additional post-acceptance sections.')) {
      return
    }

    try {
      await promoteToTier2(token, applicationId)

      // Refresh both lists
      const [allData, filteredData] = await Promise.all([
        getAllApplications(token),
        getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      ])
      setAllApplications(allData)
      setApplications(filteredData)

      alert('Application promoted to Tier 2 successfully!')
    } catch (err) {
      console.error('Failed to promote application:', err)
      alert(err instanceof Error ? err.message : 'Failed to promote application')
    }
  }

  // Legacy handler for backwards compatibility
  const handleAcceptApplication = async (applicationId: string) => {
    return handlePromoteToTier2(applicationId)
  }

  // Add to waitlist handler
  const handleAddToWaitlist = async (applicationId: string) => {
    if (!token) return

    if (!confirm('Are you sure you want to add this application to the waitlist?')) {
      return
    }

    try {
      await addToWaitlist(token, applicationId)
      const [allData, filteredData] = await Promise.all([
        getAllApplications(token),
        getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      ])
      setAllApplications(allData)
      setApplications(filteredData)
      alert('Application added to waitlist')
    } catch (err) {
      console.error('Failed to add to waitlist:', err)
      alert(err instanceof Error ? err.message : 'Failed to add to waitlist')
    }
  }

  // Remove from waitlist handler
  const handleRemoveFromWaitlist = async (applicationId: string, action: 'promote' | 'return_review') => {
    if (!token) return

    const actionText = action === 'promote' ? 'promote to Tier 2' : 'return to review'
    if (!confirm(`Are you sure you want to ${actionText} this application?`)) {
      return
    }

    try {
      await removeFromWaitlist(token, applicationId, action)
      const [allData, filteredData] = await Promise.all([
        getAllApplications(token),
        getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      ])
      setAllApplications(allData)
      setApplications(filteredData)
      alert(action === 'promote' ? 'Application promoted to Tier 2' : 'Application returned to review')
    } catch (err) {
      console.error('Failed to remove from waitlist:', err)
      alert(err instanceof Error ? err.message : 'Failed to remove from waitlist')
    }
  }

  // Defer handler
  const handleDeferApplication = async (applicationId: string) => {
    if (!token) return

    if (!confirm('Are you sure you want to defer this application to next year?')) {
      return
    }

    try {
      await deferApplication(token, applicationId)
      const [allData, filteredData] = await Promise.all([
        getAllApplications(token),
        getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      ])
      setAllApplications(allData)
      setApplications(filteredData)
      alert('Application deferred to next year')
    } catch (err) {
      console.error('Failed to defer application:', err)
      alert(err instanceof Error ? err.message : 'Failed to defer application')
    }
  }

  // Withdraw handler
  const handleWithdrawApplication = async (applicationId: string) => {
    if (!token) return

    if (!confirm('Are you sure you want to withdraw this application?')) {
      return
    }

    try {
      await withdrawApplication(token, applicationId)
      const [allData, filteredData] = await Promise.all([
        getAllApplications(token),
        getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      ])
      setAllApplications(allData)
      setApplications(filteredData)
      alert('Application withdrawn')
    } catch (err) {
      console.error('Failed to withdraw application:', err)
      alert(err instanceof Error ? err.message : 'Failed to withdraw application')
    }
  }

  // Reject handler
  const handleRejectApplication = async (applicationId: string) => {
    if (!token) return

    if (!confirm('Are you sure you want to reject this application? This action cannot be easily undone.')) {
      return
    }

    try {
      await rejectApplication(token, applicationId)
      const [allData, filteredData] = await Promise.all([
        getAllApplications(token),
        getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      ])
      setAllApplications(allData)
      setApplications(filteredData)
      alert('Application rejected')
    } catch (err) {
      console.error('Failed to reject application:', err)
      alert(err instanceof Error ? err.message : 'Failed to reject application')
    }
  }

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Same column: toggle direction, or clear if already desc
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        // Clear sort
        setSortColumn(null)
        setSortDirection('asc')
      }
    } else {
      // New column: set to asc
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Get sort icon for a column
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 ml-1 text-camp-green" />
      : <ArrowDown className="w-4 h-4 ml-1 text-camp-green" />
  }

  // Sorted applications using useMemo for performance
  const sortedApplications = useMemo(() => {
    if (!sortColumn) return applications

    return [...applications].sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'applicant': {
          const aName = `${a.user?.last_name || ''} ${a.user?.first_name || ''}`.toLowerCase()
          const bName = `${b.user?.last_name || ''} ${b.user?.first_name || ''}`.toLowerCase()
          comparison = aName.localeCompare(bName)
          break
        }
        case 'camper': {
          const aName = `${a.camper_last_name || ''} ${a.camper_first_name || ''}`.toLowerCase()
          const bName = `${b.camper_last_name || ''} ${b.camper_first_name || ''}`.toLowerCase()
          comparison = aName.localeCompare(bName)
          break
        }
        case 'status': {
          const aOrder = STATUS_ORDER[a.status] || 99
          const bOrder = STATUS_ORDER[b.status] || 99
          comparison = aOrder - bOrder
          break
        }
        case 'progress': {
          comparison = (a.completion_percentage || 0) - (b.completion_percentage || 0)
          break
        }
        case 'approvals': {
          comparison = (a.approval_count || 0) - (b.approval_count || 0)
          break
        }
        case 'created': {
          const aDate = new Date(a.created_at).getTime()
          const bDate = new Date(b.created_at).getTime()
          comparison = aDate - bDate
          break
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [applications, sortColumn, sortDirection])

  if (loading && applications.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-camp-green"></div>
      </div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-camp-green rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">C</span>
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-camp-green">CAMP FASD</h1>
                  <p className="text-xs text-gray-500">Admin Portal</p>
                </div>
              </div>
            </div>

            {/* Right: User Info and Logout */}
            <div className="flex items-center space-x-4">
              {/* Super Admin Dashboard Selector */}
              {user?.role === 'super_admin' && (
                <div className="flex items-center gap-2 mr-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/super-admin')}
                    className="text-xs"
                  >
                    Super Admin
                  </Button>
                  <span className="text-gray-300">|</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                    className="text-xs"
                  >
                    Family View
                  </Button>
                </div>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-camp-charcoal">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold text-camp-charcoal">
              Welcome back, {user?.first_name}!
            </h2>
            <Hand className="h-8 w-8 text-camp-orange" />
          </div>
          <p className="text-gray-600">Here's an overview of all applications for this season.</p>
        </div>

        {/* Stats Cards - ORDER: Total, Tier 1 Active, Needs Review, Tier 2 / Paid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 1. Total Applications */}
          <Card className="border-l-4 border-l-camp-green hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Applications</p>
                  <p className="text-3xl font-bold text-camp-charcoal">{allApplications.length}</p>
                </div>
                <div className="w-12 h-12 bg-camp-green/10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Tier 1 Active (not_started, incomplete, complete) */}
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Tier 1 Active</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {allApplications.filter(a => ['not_started', 'incomplete', 'in_progress', 'complete'].includes(a.status)).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Needs Review (under_review + waitlist) */}
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Needs Review</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {allApplications.filter(a => ['under_review', 'waitlist'].includes(a.status)).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Tier 2 / Paid (tier2_incomplete, unpaid, paid, accepted) */}
          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Tier 2 / Paid</p>
                  <p className="text-3xl font-bold text-green-600">
                    {allApplications.filter(a => ['tier2_incomplete', 'accepted', 'unpaid', 'paid'].includes(a.status)).length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {allApplications.filter(a => a.status === 'paid').length} paid
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <Card className="mb-6 shadow-md">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-camp-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <CardTitle className="text-lg">Search & Filter</CardTitle>
            </div>
            <CardDescription>Find specific applications quickly</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Applications
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-camp-green focus:ring-2 focus:ring-camp-green/20 transition-colors bg-white"
                >
                  <option value="">All Statuses</option>
                  <optgroup label="Tier 1 (Applicant)">
                    <option value="not_started">Not Started</option>
                    <option value="incomplete">In Progress</option>
                    <option value="complete">Complete</option>
                    <option value="under_review">Under Review</option>
                    <option value="waitlist">Waitlist</option>
                  </optgroup>
                  <optgroup label="Tier 2 (Camper)">
                    <option value="tier2_incomplete">Tier 2 - Incomplete</option>
                    <option value="unpaid">Awaiting Payment</option>
                    <option value="paid">Paid</option>
                  </optgroup>
                  <optgroup label="Inactive">
                    <option value="deferred">Deferred</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="rejected">Rejected</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-l-red-500 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Applications Table */}
        <Card className="shadow-md">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">All Applications</CardTitle>
                <CardDescription className="mt-1">
                  Showing {applications.length} {applications.length === 1 ? 'application' : 'applications'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No applications found
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b-2 border-gray-200">
                      <th
                        onClick={() => handleSort('applicant')}
                        className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      >
                        <span className="flex items-center">
                          Applicant
                          {getSortIcon('applicant')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('camper')}
                        className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      >
                        <span className="flex items-center">
                          Camper
                          {getSortIcon('camper')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      >
                        <span className="flex items-center">
                          Status
                          {getSortIcon('status')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('progress')}
                        className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      >
                        <span className="flex items-center">
                          Progress
                          {getSortIcon('progress')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('approvals')}
                        className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      >
                        <span className="flex items-center">
                          Approvals
                          {getSortIcon('approvals')}
                        </span>
                      </th>
                      <th
                        onClick={() => handleSort('created')}
                        className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      >
                        <span className="flex items-center">
                          Created
                          {getSortIcon('created')}
                        </span>
                      </th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {sortedApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-5 px-6">
                          <div>
                            <div className="font-semibold text-camp-charcoal">
                              {app.user?.first_name} {app.user?.last_name}
                            </div>
                            <div className="text-sm text-gray-500 mt-0.5">{app.user?.email}</div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="font-medium text-camp-charcoal">
                            {app.camper_first_name && app.camper_last_name
                              ? `${app.camper_first_name} ${app.camper_last_name}`
                              : <span className="text-gray-400 italic">Not specified</span>
                            }
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <span className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full ${getStatusBadgeColor(app.status)}`}>
                            {formatStatus(app.status)}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-2.5 max-w-[120px]">
                              <div
                                className={`h-2.5 rounded-full transition-all ${
                                  app.completion_percentage === 100 ? 'bg-green-500' : 'bg-camp-green'
                                }`}
                                style={{ width: `${app.completion_percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 min-w-[45px]">
                              {app.completion_percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold text-gray-700">
                              {app.approval_count || 0} / 3
                            </div>
                            {app.approved_by_teams && app.approved_by_teams.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {app.approved_by_teams.map((team, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800"
                                  >
                                    {team}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="text-sm text-gray-600">
                            {formatDateCST(app.created_at)}
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/applications/${app.id}`)}
                              className="font-medium whitespace-nowrap"
                            >
                              👁️ View
                            </Button>

                            {/* Status-specific primary action */}
                            {app.status === 'under_review' && (app.approval_count || 0) >= 3 && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handlePromoteToTier2(app.id)}
                                className="font-medium whitespace-nowrap"
                              >
                                ✓ Promote
                              </Button>
                            )}

                            {app.status === 'waitlist' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleRemoveFromWaitlist(app.id, 'promote')}
                                className="font-medium whitespace-nowrap"
                              >
                                ✓ Promote
                              </Button>
                            )}

                            {/* Tier 2 statuses - show status indicator */}
                            {(app.status === 'tier2_incomplete' || app.status === 'accepted') && (
                              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-800">
                                Tier 2
                              </span>
                            )}

                            {app.status === 'unpaid' && (
                              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-800">
                                Awaiting Payment
                              </span>
                            )}

                            {app.status === 'paid' && (
                              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                ✓ Paid
                              </span>
                            )}

                            {/* Inactive status indicators */}
                            {app.status === 'deferred' && (
                              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                                Deferred
                              </span>
                            )}

                            {app.status === 'withdrawn' && (
                              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                                Withdrawn
                              </span>
                            )}

                            {(app.status === 'rejected' || app.status === 'declined') && (
                              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Rejected
                              </span>
                            )}

                            {/* Dropdown menu for additional actions (only for non-terminal statuses) */}
                            {!['paid', 'deferred', 'withdrawn', 'rejected', 'declined'].includes(app.status) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {/* Under Review actions */}
                                  {app.status === 'under_review' && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => handleAddToWaitlist(app.id)}
                                        className="cursor-pointer"
                                      >
                                        <Clock className="mr-2 h-4 w-4 text-orange-500" />
                                        Add to Waitlist
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleRejectApplication(app.id)}
                                        className="cursor-pointer text-red-600"
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Reject
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}

                                  {/* Waitlist actions */}
                                  {app.status === 'waitlist' && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => handleRemoveFromWaitlist(app.id, 'return_review')}
                                        className="cursor-pointer"
                                      >
                                        <ArrowRightCircle className="mr-2 h-4 w-4 text-blue-500" />
                                        Return to Review
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}

                                  {/* Tier 2 actions */}
                                  {['tier2_incomplete', 'accepted', 'unpaid'].includes(app.status) && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => handleWithdrawApplication(app.id)}
                                        className="cursor-pointer"
                                      >
                                        <XCircle className="mr-2 h-4 w-4 text-gray-500" />
                                        Withdraw
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}

                                  {/* Defer is available for most statuses */}
                                  {['incomplete', 'in_progress', 'complete', 'under_review', 'waitlist', 'tier2_incomplete', 'accepted', 'unpaid'].includes(app.status) && (
                                    <DropdownMenuItem
                                      onClick={() => handleDeferApplication(app.id)}
                                      className="cursor-pointer text-slate-600"
                                    >
                                      <CalendarX className="mr-2 h-4 w-4" />
                                      Defer to Next Year
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
