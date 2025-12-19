'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getDashboardStats, getTeamPerformance, type DashboardStats, type TeamPerformance } from '@/lib/api-super-admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function SuperAdminDashboard() {
  const router = useRouter()
  const { token } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const loadData = async () => {
      try {
        setLoading(true)
        const [statsData, teamData] = await Promise.all([
          getDashboardStats(token),
          getTeamPerformance(token)
        ])
        setStats(statsData)
        setTeamPerformance(teamData)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-camp-green border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Failed to load dashboard'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Complete system overview and management controls
        </p>
      </div>

      {/* Applications Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Applications</h2>
        <p className="text-sm text-gray-500 mb-4">Click any card to view filtered applications</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900 group-hover:text-camp-green transition-colors">{stats.total_applications}</div>
              <div className="text-sm text-gray-600">Total (All Time)</div>
              <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View all →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600 group-hover:text-blue-700 transition-colors">{stats.applications_this_season}</div>
              <div className="text-sm text-gray-600">This Season</div>
              <div className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View all →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-gray-400 transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant:incomplete')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-600 group-hover:text-gray-800 transition-colors">{stats.applications_in_progress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
              <div className="text-xs text-gray-400 mt-1">Family still filling out form</div>
              <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View in progress →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-orange-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant:under_review')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600 group-hover:text-orange-700 transition-colors">{stats.applications_under_review}</div>
              <div className="text-sm text-gray-600">Under Review</div>
              <div className="text-xs text-gray-400 mt-1">100% complete, awaiting approval</div>
              <div className="text-xs text-orange-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View pending reviews →</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=camper')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600 group-hover:text-green-700 transition-colors">{stats.applications_accepted}</div>
              <div className="text-sm text-gray-600">Accepted</div>
              <div className="text-xs text-gray-400 mt-1">Promoted to camper</div>
              <div className="text-xs text-green-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View campers →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=camper:complete:paid')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600 group-hover:text-purple-700 transition-colors">{stats.applications_paid}</div>
              <div className="text-sm text-gray-600">Paid</div>
              <div className="text-xs text-gray-400 mt-1">Tuition received</div>
              <div className="text-xs text-purple-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View paid campers →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-amber-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=camper:complete:unpaid')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600 group-hover:text-amber-700 transition-colors">{stats.outstanding_payments}</div>
              <div className="text-sm text-gray-600">Unpaid</div>
              <div className="text-xs text-gray-400 mt-1">Accepted, awaiting payment</div>
              <div className="text-xs text-amber-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View unpaid →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-red-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=inactive:rejected')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600 group-hover:text-red-700 transition-colors">{stats.applications_declined}</div>
              <div className="text-sm text-gray-600">Declined</div>
              <div className="text-xs text-gray-400 mt-1">Application rejected</div>
              <div className="text-xs text-red-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View rejected →</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Users Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900">{stats.total_users}</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{stats.total_families}</div>
              <div className="text-sm text-gray-600">Family Accounts</div>
              <div className="text-xs text-gray-500 mt-1">Parent/guardian registrations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.total_admins}</div>
              <div className="text-sm text-gray-600">Admins</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">{stats.total_super_admins}</div>
              <div className="text-sm text-gray-600">Super Admins</div>
              <div className="text-xs text-gray-500 mt-1">
                +{stats.new_users_this_week} this week
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900">
                {stats.avg_completion_days !== null
                  ? `${stats.avg_completion_days.toFixed(1)} days`
                  : 'N/A'
                }
              </div>
              <div className="text-sm text-gray-600">Avg. Completion Time</div>
              <div className="text-xs text-gray-500 mt-1">From start to submit</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900">
                {stats.avg_review_days !== null
                  ? `${stats.avg_review_days.toFixed(1)} days`
                  : 'N/A'
                }
              </div>
              <div className="text-sm text-gray-600">Avg. Review Time</div>
              <div className="text-xs text-gray-500 mt-1">From submit to accept</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{stats.outstanding_payments}</div>
              <div className="text-sm text-gray-600">Outstanding Payments</div>
              <div className="text-xs text-gray-500 mt-1">Accepted but not paid</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Team Performance */}
      {teamPerformance.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h2>
          <Card>
            <CardContent className="pt-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Admins
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reviewed
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg. Review Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approval Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamPerformance.map((team) => (
                    <tr key={team.team_key}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {team.team_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {team.admin_count}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {team.applications_reviewed}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {team.avg_review_time_days !== null
                          ? `${team.avg_review_time_days.toFixed(1)} days`
                          : 'N/A'
                        }
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {team.approval_rate !== null
                          ? `${team.approval_rate.toFixed(1)}%`
                          : 'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
