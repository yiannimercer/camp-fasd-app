'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getAllApplications, ApplicationWithUser } from '@/lib/api-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  UserCheck,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  XCircle,
  TrendingUp
} from 'lucide-react'

/**
 * Admin Dashboard - God's eye view of camp application status
 *
 * Shows hierarchical funnel:
 * - Top summary: Total Apps, Applicants, Campers
 * - Applicants breakdown: Incomplete, Complete, Under Review, Waitlist
 * - Campers 2x2 matrix: Application status x Payment status
 * - Inactive: Deferred/Withdrawn/Rejected
 * - Historical: All-time total
 */
export default function AdminDashboard() {
  const router = useRouter()
  const { token } = useAuth()
  const [applications, setApplications] = useState<ApplicationWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all applications on mount
  useEffect(() => {
    if (!token) return

    const loadData = async () => {
      try {
        setLoading(true)
        const data = await getAllApplications(token)
        setApplications(data)
      } catch (err) {
        console.error('Failed to load applications:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token])

  // Calculate all stats from applications data
  const stats = useMemo(() => {
    // Top-level counts
    const total = applications.length
    const applicants = applications.filter(a => a.status === 'applicant')
    const campers = applications.filter(a => a.status === 'camper')
    const inactive = applications.filter(a => a.status === 'inactive')

    // Applicant breakdown by sub_status
    const applicantIncomplete = applicants.filter(a =>
      ['not_started', 'incomplete'].includes(a.sub_status)
    ).length
    const applicantComplete = applicants.filter(a =>
      a.sub_status === 'complete'
    ).length
    const applicantUnderReview = applicants.filter(a =>
      a.sub_status === 'under_review'
    ).length
    const applicantWaitlist = applicants.filter(a =>
      a.sub_status === 'waitlist'
    ).length

    // Camper 2x2 matrix: sub_status (incomplete/complete) x paid_invoice (true/false)
    const camperIncompleteUnpaid = campers.filter(a =>
      a.sub_status !== 'complete' && a.paid_invoice !== true
    ).length
    const camperIncompletePaid = campers.filter(a =>
      a.sub_status !== 'complete' && a.paid_invoice === true
    ).length
    const camperCompleteUnpaid = campers.filter(a =>
      a.sub_status === 'complete' && a.paid_invoice !== true
    ).length
    const camperCompletePaid = campers.filter(a =>
      a.sub_status === 'complete' && a.paid_invoice === true
    ).length

    return {
      total,
      applicantCount: applicants.length,
      camperCount: campers.length,
      inactiveCount: inactive.length,
      // Applicant breakdown
      applicantIncomplete,
      applicantComplete,
      applicantUnderReview,
      applicantWaitlist,
      // Camper matrix
      camperIncompleteUnpaid,
      camperIncompletePaid,
      camperCompleteUnpaid,
      camperCompletePaid,
      // Derived
      totalPaid: camperIncompletePaid + camperCompletePaid,
      totalUnpaid: camperIncompleteUnpaid + camperCompleteUnpaid,
    }
  }, [applications])

  // Navigate to applications page with filter
  const navigateWithFilter = (filter: string) => {
    router.push(`/admin/applications?status=${filter}`)
  }

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Camp Year {currentYear} - Overview of all applications
        </p>
      </div>

      {/* Top-Level Summary */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Applications */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all group bg-gradient-to-br from-gray-50 to-gray-100 border-2"
            onClick={() => navigateWithFilter('')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold text-gray-900 group-hover:text-camp-green transition-colors">
                    {stats.total}
                  </div>
                  <div className="text-sm font-medium text-gray-600 mt-1">Total Applications</div>
                </div>
                <ClipboardList className="h-12 w-12 text-gray-300 group-hover:text-gray-400 transition-colors" />
              </div>
              <div className="text-xs text-gray-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                View all applications →
              </div>
            </CardContent>
          </Card>

          {/* Applicants */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200"
            onClick={() => navigateWithFilter('applicant')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold text-blue-600 group-hover:text-blue-700 transition-colors">
                    {stats.applicantCount}
                  </div>
                  <div className="text-sm font-medium text-blue-700 mt-1">Applicants</div>
                </div>
                <Users className="h-12 w-12 text-blue-200 group-hover:text-blue-300 transition-colors" />
              </div>
              <div className="text-xs text-blue-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                View applicants →
              </div>
            </CardContent>
          </Card>

          {/* Campers */}
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all group bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200"
            onClick={() => navigateWithFilter('camper')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold text-green-600 group-hover:text-green-700 transition-colors">
                    {stats.camperCount}
                  </div>
                  <div className="text-sm font-medium text-green-700 mt-1">Campers</div>
                </div>
                <UserCheck className="h-12 w-12 text-green-200 group-hover:text-green-300 transition-colors" />
              </div>
              <div className="text-xs text-green-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                View campers →
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Applicants Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Applicants Breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Incomplete */}
          <Card
            className="cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group"
            onClick={() => navigateWithFilter('applicant:incomplete')}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-700">{stats.applicantIncomplete}</div>
                  <div className="text-sm text-gray-500">Incomplete</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-2">Still filling out application</div>
            </CardContent>
          </Card>

          {/* Complete (not reviewed) */}
          <Card
            className="cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
            onClick={() => navigateWithFilter('applicant:complete')}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{stats.applicantComplete}</div>
                  <div className="text-sm text-gray-500">Complete</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-2">Ready for admin review</div>
            </CardContent>
          </Card>

          {/* Under Review */}
          <Card
            className="cursor-pointer hover:shadow-md hover:border-orange-300 transition-all group"
            onClick={() => navigateWithFilter('applicant:under_review')}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{stats.applicantUnderReview}</div>
                  <div className="text-sm text-gray-500">Under Review</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-2">Admin action taken</div>
            </CardContent>
          </Card>
        </div>

        {/* Waitlist - Full Width */}
        <Card
          className="cursor-pointer hover:shadow-md hover:border-sky-300 transition-all group bg-gradient-to-r from-sky-50 to-sky-100 border-sky-200"
          onClick={() => navigateWithFilter('applicant:waitlist')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-200 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-sky-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-sky-700">{stats.applicantWaitlist}</div>
                  <div className="text-sm text-sky-600">Waitlist</div>
                </div>
              </div>
              <div className="text-xs text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                View waitlisted →
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campers Section - 2x2 Matrix */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Campers Status Matrix
        </h2>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Matrix Header */}
            <div className="grid grid-cols-3 bg-gray-50 border-b">
              <div className="p-3 font-medium text-sm text-gray-500">Application</div>
              <div className="p-3 font-medium text-sm text-gray-500 text-center border-l bg-rose-50">
                <DollarSign className="h-4 w-4 inline mr-1 text-rose-400" />
                Unpaid
              </div>
              <div className="p-3 font-medium text-sm text-gray-500 text-center border-l bg-emerald-50">
                <DollarSign className="h-4 w-4 inline mr-1 text-emerald-400" />
                Paid
              </div>
            </div>

            {/* Row 1: Incomplete */}
            <div className="grid grid-cols-3 border-b">
              <div className="p-3 font-medium text-sm text-gray-600 bg-gray-50 flex items-center">
                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                Incomplete
              </div>
              <div
                className="p-3 text-center border-l bg-rose-50 hover:bg-rose-100 cursor-pointer transition-colors group"
                onClick={() => navigateWithFilter('camper:incomplete:unpaid')}
              >
                <div className="text-2xl font-bold text-rose-600">{stats.camperIncompleteUnpaid}</div>
                <div className="text-xs text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">View →</div>
              </div>
              <div
                className="p-3 text-center border-l bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors group"
                onClick={() => navigateWithFilter('camper:incomplete:paid')}
              >
                <div className="text-2xl font-bold text-emerald-600">{stats.camperIncompletePaid}</div>
                <div className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">View →</div>
              </div>
            </div>

            {/* Row 2: Complete */}
            <div className="grid grid-cols-3">
              <div className="p-3 font-medium text-sm text-gray-600 bg-gray-50 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-gray-400" />
                Complete
              </div>
              <div
                className="p-3 text-center border-l bg-rose-50 hover:bg-rose-100 cursor-pointer transition-colors group"
                onClick={() => navigateWithFilter('camper:complete:unpaid')}
              >
                <div className="text-2xl font-bold text-rose-600">{stats.camperCompleteUnpaid}</div>
                <div className="text-xs text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">View →</div>
              </div>
              <div
                className="p-3 text-center border-l bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors group"
                onClick={() => navigateWithFilter('camper:complete:paid')}
              >
                <div className="text-2xl font-bold text-emerald-600">{stats.camperCompletePaid}</div>
                <div className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">View →</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary row below matrix */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Card className="bg-rose-50 border-rose-200">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-rose-700">Total Unpaid Campers</span>
                <span className="text-xl font-bold text-rose-600">{stats.totalUnpaid}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-700">Total Paid Campers</span>
                <span className="text-xl font-bold text-emerald-600">{stats.totalPaid}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Inactive Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          Inactive
        </h2>
        <Card
          className="cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200"
          onClick={() => navigateWithFilter('inactive')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <XCircle className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-600">{stats.inactiveCount}</div>
                  <div className="text-sm text-slate-500">Deferred / Withdrawn / Rejected</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                View inactive →
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Historical
        </h2>
        <Card className="bg-gradient-to-r from-gray-800 to-gray-900 border-0">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-300 mt-1">Total Applications (All Time)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Click any stat card above to view filtered applications.
          Use the <strong>Applications</strong> page in the sidebar for detailed review and search.
        </p>
      </div>
    </div>
  )
}
