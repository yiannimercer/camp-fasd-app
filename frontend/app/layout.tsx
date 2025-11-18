import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from '@/lib/contexts/AuthContext'
import FeedbackWidget from '@/components/FeedbackWidget'
import '../styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CAMP FASD Application Portal',
  description: 'Camper application system for CAMP – A FASD Community',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  return (
    <html lang="en">
      <body className={inter.className}>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>
            <FeedbackWidget>
              {children}
            </FeedbackWidget>
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  )
}