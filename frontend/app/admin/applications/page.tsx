/**
 * Admin Applications List Page
 * View and filter all applications
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getAllApplications, ApplicationWithUser } from '@/lib/api-admin'
import { acceptApplication } from '@/lib/api-admin-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateCST } from '@/lib/date-utils'
import { Hand } from 'lucide-react'

export default function AdminApplicationsPage() {
  const router = useRouter()
  const { token, user, logout } = useAuth()
  const [applications, setApplications] = useState<ApplicationWithUser[]>([])
  const [allApplications, setAllApplications] = useState<ApplicationWithUser[]>([]) // For stats (unfiltered)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [error, setError] = useState<string>('')

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
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'accepted':
        return 'bg-green-100 text-green-800'
      case 'declined':
        return 'bg-red-100 text-red-800'
      case 'paid':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const handleAcceptApplication = async (applicationId: string) => {
    if (!token) return

    if (!confirm('Are you sure you want to accept this application? This will notify the family and enable conditional post-acceptance sections.')) {
      return
    }

    try {
      await acceptApplication(token, applicationId)

      // Refresh both lists
      const [allData, filteredData] = await Promise.all([
        getAllApplications(token),
        getAllApplications(token, statusFilter || undefined, searchTerm || undefined)
      ])
      setAllApplications(allData)
      setApplications(filteredData)

      alert('Application accepted successfully!')
    } catch (err) {
      console.error('Failed to accept application:', err)
      alert(err instanceof Error ? err.message : 'Failed to accept application')
    }
  }

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

        {/* Stats Cards - ORDER: Total, In Progress, Under Review, Accepted */}
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

          {/* 2. In Progress */}
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">In Progress</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {allApplications.filter(a => a.status === 'in_progress').length}
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

          {/* 3. Under Review */}
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Under Review</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {allApplications.filter(a => a.status === 'under_review').length}
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

          {/* 4. Accepted */}
          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Accepted</p>
                  <p className="text-3xl font-bold text-green-600">
                    {allApplications.filter(a => a.status === 'accepted').length}
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
                  <option value="in_progress">In Progress</option>
                  <option value="under_review">Under Review</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                  <option value="paid">Paid</option>
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
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Applicant</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Camper</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Approvals</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {applications.map((app) => (
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
                            {app.status === 'accepted' || app.status === 'paid' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="font-medium whitespace-nowrap bg-green-50 text-green-700 border-green-200"
                              >
                                ✓ Accepted
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={(app.approval_count || 0) < 3 || app.status !== 'under_review'}
                                onClick={() => handleAcceptApplication(app.id)}
                                className="font-medium whitespace-nowrap"
                              >
                                ✓ Accept
                              </Button>
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
