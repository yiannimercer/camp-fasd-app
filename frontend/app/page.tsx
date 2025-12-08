/**
 * Landing Page
 * Welcoming entry point for families applying to CAMP FASD
 */

import Link from 'next/link'
import { TreePine, Sun, Mountain, Tent, ArrowRight, Sparkles, Heart, Users, Shield } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      {/* Animated Background - Golden Hour Sky */}
      <div className="fixed inset-0 bg-gradient-to-b from-amber-100 via-orange-50 to-emerald-50 -z-10" />

      {/* Floating Nature Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-5">
        {/* Sun with glow */}
        <div className="absolute top-16 right-[15%] animate-float-slow">
          <div className="relative">
            <div className="absolute inset-0 w-32 h-32 bg-amber-300/30 rounded-full blur-3xl" />
            <Sun className="w-24 h-24 text-amber-400 drop-shadow-lg" strokeWidth={1.5} />
          </div>
        </div>

        {/* Decorative trees */}
        <TreePine className="absolute bottom-0 left-[5%] w-48 h-48 text-camp-green/20 transform -rotate-3" />
        <TreePine className="absolute bottom-0 left-[15%] w-36 h-36 text-camp-green/15 transform rotate-2" />
        <TreePine className="absolute bottom-0 right-[8%] w-44 h-44 text-camp-green/20 transform rotate-3" />
        <TreePine className="absolute bottom-0 right-[20%] w-32 h-32 text-camp-green/15 transform -rotate-2" />

        {/* Mountain silhouette */}
        <Mountain className="absolute bottom-0 left-[30%] w-64 h-64 text-emerald-800/10" />
        <Mountain className="absolute bottom-0 right-[25%] w-56 h-56 text-emerald-700/10" />

        {/* Floating leaves/sparkles */}
        <div className="absolute top-[20%] left-[10%] animate-float-gentle">
          <Sparkles className="w-6 h-6 text-amber-400/40" />
        </div>
        <div className="absolute top-[35%] right-[12%] animate-float-gentle-delayed">
          <Sparkles className="w-5 h-5 text-camp-orange/30" />
        </div>
        <div className="absolute top-[60%] left-[8%] animate-float-gentle">
          <Sparkles className="w-4 h-4 text-camp-green/30" />
        </div>
      </div>

      {/* Header */}
      <header className="relative bg-white/70 backdrop-blur-md border-b border-white/50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="p-2 bg-gradient-to-br from-camp-green to-emerald-600 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow">
              <TreePine className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-camp-green to-emerald-600 bg-clip-text text-transparent">
                CAMP FASD
              </h1>
              <p className="text-xs text-gray-500 tracking-wide">A Community for FASD Families</p>
            </div>
          </Link>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 text-camp-green font-semibold rounded-xl hover:bg-camp-green/5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 bg-gradient-to-r from-camp-orange to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-white/50 mb-8 animate-fade-in">
            <Tent className="w-4 h-4 text-camp-green" />
            <span className="text-sm font-medium text-gray-700">Summer 2025 Applications Open</span>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>

          {/* Main Headline */}
          <h2 className="text-5xl md:text-7xl font-bold text-camp-charcoal mb-6 leading-tight animate-fade-in-up">
            Where Every
            <span className="block bg-gradient-to-r from-camp-green via-emerald-500 to-camp-green bg-clip-text text-transparent">
              Camper Belongs
            </span>
          </h2>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delayed opacity-0">
            A specialized summer camp experience designed for children and youth with Fetal Alcohol Spectrum Disorder.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up-more-delayed opacity-0">
            <Link
              href="/register"
              className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-camp-green to-emerald-600 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-camp-green/25 hover:shadow-2xl hover:shadow-camp-green/30 hover:scale-[1.02] transition-all"
            >
              Apply Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="group flex items-center gap-2 px-8 py-4 bg-white/80 backdrop-blur-sm text-camp-charcoal text-lg font-semibold rounded-2xl border-2 border-gray-200 hover:border-camp-green/30 hover:bg-white transition-all"
            >
              Continue Application
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative bg-white/60 backdrop-blur-sm border-y border-white/50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-white/50 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-gradient-to-br from-rose-100 to-rose-50 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Heart className="w-7 h-7 text-rose-500" />
                </div>
                <h3 className="text-xl font-bold text-camp-charcoal mb-3">Specialized Care</h3>
                <p className="text-gray-600 leading-relaxed">
                  Trained staff who understand FASD and create a supportive, structured environment for every camper.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-white/50 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-camp-charcoal mb-3">Community</h3>
                <p className="text-gray-600 leading-relaxed">
                  Connect with other FASD families. Campers make lasting friendships in a welcoming environment.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-white/50 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Shield className="w-7 h-7 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-camp-charcoal mb-3">Safe & Fun</h3>
                <p className="text-gray-600 leading-relaxed">
                  A safe space to learn, grow, and have the summer camp experience every child deserves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simple CTA Section */}
      <section className="relative py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-3xl md:text-4xl font-bold text-camp-charcoal mb-6">
              Ready to Join the Camp Family?
            </h3>
            <p className="text-lg text-gray-600 mb-8">
              The application takes about 30 minutes. You can save your progress and return anytime.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-camp-orange to-amber-500 text-white text-lg font-semibold rounded-2xl shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:shadow-orange-500/30 hover:scale-[1.02] transition-all"
            >
              Start Your Application
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-camp-charcoal text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-camp-green/20 rounded-lg">
                <TreePine className="h-6 w-6 text-camp-green" />
              </div>
              <div>
                <p className="font-semibold">CAMP FASD</p>
                <p className="text-sm text-white/60">A Community for FASD Families</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/60">
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-white transition-colors">Apply</Link>
            </div>
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} CAMP FASD. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </main>
  )
}
