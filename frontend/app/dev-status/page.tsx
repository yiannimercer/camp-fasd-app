/**
 * Developer Status Page
 * Shows system status for developers - not for end users
 */

import Link from 'next/link'
import { CheckCircle2, Construction, ExternalLink, Database, Server, Monitor } from 'lucide-react'

export default function DevStatusPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-camp-green rounded-lg">
              <Construction className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">CAMP FASD</h1>
              <p className="text-gray-400 text-xs">Developer Status</p>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Main Site
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">
              System Status
            </h2>
            <p className="text-gray-400">
              Development environment overview
            </p>
          </div>

          {/* Status Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* Backend Status */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-camp-green" />
                  <h3 className="text-lg font-semibold text-white">Backend API</h3>
                </div>
                <span className="px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-xs font-medium border border-green-800">
                  Running
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-4">FastAPI server is active and healthy</p>
              <a
                href="http://localhost:8000/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-camp-green hover:text-camp-orange text-sm font-medium transition-colors"
              >
                View API Docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Database Status */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-camp-orange" />
                  <h3 className="text-lg font-semibold text-white">Database</h3>
                </div>
                <span className="px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-xs font-medium border border-green-800">
                  Connected
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-2">Supabase PostgreSQL</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> 17 application sections
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> 44 sample questions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Super admin configured
                </li>
              </ul>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Monitor className="h-5 w-5 text-camp-green" />
              Development Checklist
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white text-sm">Foundation Complete</p>
                  <p className="text-gray-500 text-xs">
                    Project structure, database schema, and configuration are ready
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white text-sm">Backend Running</p>
                  <p className="text-gray-500 text-xs">
                    FastAPI server on port 8000 with health check endpoints
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white text-sm">Frontend Running</p>
                  <p className="text-gray-500 text-xs">
                    Next.js development server on port 3000
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Construction className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-white text-sm">Ready for Development</p>
                  <p className="text-gray-500 text-xs">
                    Authentication, application forms, and admin dashboard ready to build
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid md:grid-cols-3 gap-4">
            <a
              href="http://localhost:8000/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-camp-green hover:bg-camp-green/90 text-white rounded-lg p-4 text-center text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              API Documentation <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-camp-orange hover:bg-camp-orange/90 text-white rounded-lg p-4 text-center text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              Supabase Dashboard <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="http://localhost:8000/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg p-4 text-center text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              Health Check <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-700 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            CAMP FASD | Developer Status Page
          </p>
          <p className="text-gray-600 text-xs mt-1">
            This page is only for developers. Users should visit the main site.
          </p>
        </div>
      </footer>
    </main>
  )
}
