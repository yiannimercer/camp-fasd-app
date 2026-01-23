/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // SECURITY TODO: Set to false once existing TypeScript errors are fixed
    // This will enforce type checking at build time
    ignoreBuildErrors: true,
  },
  eslint: {
    // SECURITY TODO: Set to false once existing ESLint errors are fixed
    // This will enforce linting at build time
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['mtxjtriqduylfakqeiod.supabase.co'],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Existing COOP header for Google OAuth popups
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          // Content Security Policy - prevents XSS and other injection attacks
          {
            key: 'Content-Security-Policy',
            value: [
              // Default to self for most resources
              "default-src 'self'",
              // Scripts: self, inline (for Next.js), eval (for development), and trusted CDNs
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://js.stripe.com",
              // Styles: self and inline (required for styled-components and Tailwind)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: self, data URIs, and trusted storage
              "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com",
              // Fonts: self and Google Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Connect: API backends and services
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://api.stripe.com https://api.fasdcamp.org https://api-dev.fasdcamp.org",
              // Frames: Google OAuth and Stripe
              "frame-src 'self' https://accounts.google.com https://js.stripe.com",
              // Objects: none (no Flash/plugins)
              "object-src 'none'",
              // Base URI: self only
              "base-uri 'self'",
              // Form actions: self only
              "form-action 'self'",
              // Frame ancestors: none (prevent clickjacking)
              "frame-ancestors 'none'",
              // Block mixed content
              "block-all-mixed-content",
              // Upgrade insecure requests in production
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions Policy - restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
