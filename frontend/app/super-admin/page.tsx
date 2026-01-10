'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useStatusColors } from '@/lib/contexts/StatusColorsContext'
import { getDashboardStats, getTeamPerformance, type DashboardStats, type TeamPerformance } from '@/lib/api-super-admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function SuperAdminDashboard() {
  const router = useRouter()
  const { token } = useAuth()
  const { getStatusColor, getCategoryColor } = useStatusColors()
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

  // Calculate totals for display
  const totalApplicants = stats.applicant_not_started + stats.applicant_incomplete + stats.applicant_complete + stats.applicant_under_review + stats.applicant_waitlisted
  const totalInactive = stats.inactive_withdrawn + stats.inactive_deferred + stats.inactive_deactivated

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Complete system overview and management controls
        </p>
      </div>

      {/* Application Totals */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Application Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all group"
            onClick={() => router.push('/admin/applications')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900 group-hover:text-camp-green transition-colors">
                {stats.total_applications}
              </div>
              <div className="text-sm text-gray-600">Total (All Time)</div>
              <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View all →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group"
            onClick={() => router.push('/admin/applications')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600 group-hover:text-blue-700 transition-colors">
                {stats.applications_this_season}
              </div>
              <div className="text-sm text-gray-600">This Season</div>
              <div className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View all →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getCategoryColor('applicant').text }}
              >
                {totalApplicants}
              </div>
              <div className="text-sm text-gray-600">Applicants</div>
              <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View applicants →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=camper')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getCategoryColor('camper').text }}
              >
                {stats.camper_total}
              </div>
              <div className="text-sm text-gray-600">Campers</div>
              <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View campers →</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Applicant Pipeline */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Applicant Pipeline</h2>
        <p className="text-sm text-gray-500 mb-4">Click any card to view filtered applications</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant&sub_status=not_started')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getStatusColor('applicant', 'not_started').text }}
              >
                {stats.applicant_not_started}
              </div>
              <div className="text-sm text-gray-600">Not Started</div>
              <div className="text-xs text-gray-400 mt-1">Created, not opened</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant&sub_status=incomplete')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getStatusColor('applicant', 'incomplete').text }}
              >
                {stats.applicant_incomplete}
              </div>
              <div className="text-sm text-gray-600">Incomplete</div>
              <div className="text-xs text-gray-400 mt-1">User filling out form</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant&sub_status=complete')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getStatusColor('applicant', 'complete').text }}
              >
                {stats.applicant_complete}
              </div>
              <div className="text-sm text-gray-600">Complete</div>
              <div className="text-xs text-gray-400 mt-1">100%, ready for review</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant&sub_status=under_review')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getStatusColor('applicant', 'under_review').text }}
              >
                {stats.applicant_under_review}
              </div>
              <div className="text-sm text-gray-600">Under Review</div>
              <div className="text-xs text-gray-400 mt-1">Admin reviewing</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=applicant&sub_status=waitlisted')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getStatusColor('applicant', 'waitlisted').text }}
              >
                {stats.applicant_waitlisted}
              </div>
              <div className="text-sm text-gray-600">Waitlisted</div>
              <div className="text-xs text-gray-400 mt-1">Staffing pending</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Camper Pipeline */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Camper Pipeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=camper&sub_status=incomplete')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getStatusColor('camper', 'incomplete').text }}
              >
                {stats.camper_incomplete}
              </div>
              <div className="text-sm text-gray-600">Incomplete</div>
              <div className="text-xs text-gray-400 mt-1">Additional forms pending</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-all group"
            onClick={() => router.push('/admin/applications?status=camper&sub_status=complete')}
          >
            <CardContent className="pt-6">
              <div
                className="text-2xl font-bold"
                style={{ color: getStatusColor('camper', 'complete').text }}
              >
                {stats.camper_complete}
              </div>
              <div className="text-sm text-gray-600">Complete</div>
              <div className="text-xs text-gray-400 mt-1">All forms submitted</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-amber-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=camper&paid=false')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600 group-hover:text-amber-700 transition-colors">
                {stats.camper_unpaid}
              </div>
              <div className="text-sm text-gray-600">Unpaid</div>
              <div className="text-xs text-gray-400 mt-1">Invoice pending</div>
              <div className="text-xs text-amber-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View unpaid →</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all group"
            onClick={() => router.push('/admin/applications?status=camper&paid=true')}
          >
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600 group-hover:text-green-700 transition-colors">
                {stats.camper_paid}
              </div>
              <div className="text-sm text-gray-600">Paid</div>
              <div className="text-xs text-gray-400 mt-1">Tuition received</div>
              <div className="text-xs text-green-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View paid →</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inactive Applications */}
      {totalInactive > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inactive Applications</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="cursor-pointer hover:shadow-lg transition-all group"
              onClick={() => router.push('/admin/applications?status=inactive&sub_status=withdrawn')}
            >
              <CardContent className="pt-6">
                <div
                  className="text-2xl font-bold"
                  style={{ color: getStatusColor('inactive', 'withdrawn').text }}
                >
                  {stats.inactive_withdrawn}
                </div>
                <div className="text-sm text-gray-600">Withdrawn</div>
                <div className="text-xs text-gray-400 mt-1">Family withdrew</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-lg transition-all group"
              onClick={() => router.push('/admin/applications?status=inactive&sub_status=deferred')}
            >
              <CardContent className="pt-6">
                <div
                  className="text-2xl font-bold"
                  style={{ color: getStatusColor('inactive', 'deferred').text }}
                >
                  {stats.inactive_deferred}
                </div>
                <div className="text-sm text-gray-600">Deferred</div>
                <div className="text-xs text-gray-400 mt-1">Not accepted this year</div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-lg transition-all group"
              onClick={() => router.push('/admin/applications?status=inactive&sub_status=inactive')}
            >
              <CardContent className="pt-6">
                <div
                  className="text-2xl font-bold"
                  style={{ color: getStatusColor('inactive', 'inactive').text }}
                >
                  {stats.inactive_deactivated}
                </div>
                <div className="text-sm text-gray-600">Deactivated</div>
                <div className="text-xs text-gray-400 mt-1">Season ended</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
              <div className="text-sm text-gray-600">User Accounts</div>
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
                +{stats.new_users_this_week} new users this week
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-900">
                {stats.avg_completion_days !== null
                  ? `${stats.avg_completion_days.toFixed(1)} days`
                  : 'N/A'
                }
              </div>
              <div className="text-sm text-gray-600">Avg. Completion Time</div>
              <div className="text-xs text-gray-500 mt-1">From start to complete</div>
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
              <div className="text-2xl font-bold text-amber-600">{stats.camper_unpaid}</div>
              <div className="text-sm text-gray-600">Outstanding Payments</div>
              <div className="text-xs text-gray-500 mt-1">Accepted but not paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                ${stats.total_revenue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Revenue (Paid)</div>
              <div className="text-xs text-gray-500 mt-1">Based on tuition collected</div>
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
                      Members
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
