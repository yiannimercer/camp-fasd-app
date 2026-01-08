import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/contexts/AuthContext'
import { StatusColorsProvider } from '@/lib/contexts/StatusColorsContext'
import { TeamColorsProvider } from '@/lib/contexts/TeamColorsContext'
import { ToastProvider } from '@/components/shared/ToastNotification'
import { RoleBanner } from '@/components/RoleBanner'
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
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <StatusColorsProvider>
            <TeamColorsProvider>
              <ToastProvider>
                <RoleBanner />
                <FeedbackWidget>
                  {children}
                </FeedbackWidget>
              </ToastProvider>
            </TeamColorsProvider>
          </StatusColorsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
