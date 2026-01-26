/**
 * Feedback Widget Component
 *
 * Wraps the React Roast feedback widget with our custom configuration
 * and Supabase integration. Only shown in dev environment.
 */

'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { handleFeedbackSubmit, getFeedbackEnabled } from '@/lib/feedback-handler'

// Dynamically import WidgetProvider to avoid SSR issues
const WidgetProvider = dynamic(() => import('react-roast'), {
  ssr: false,
})

interface FeedbackWidgetProps {
  children: React.ReactNode
}

export default function FeedbackWidget({ children }: FeedbackWidgetProps) {
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    // Check if feedback is enabled via super admin setting
    getFeedbackEnabled().then(setIsEnabled)
  }, [])

  useEffect(() => {
    // Replace "Roast Mode" with "Feedback Mode" after widget loads
    const replaceRoastText = () => {
      const textNodes: Node[] = []
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      )

      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes('Roast')) {
          textNodes.push(node)
        }
      }

      textNodes.forEach((node) => {
        if (node.textContent) {
          node.textContent = node.textContent.replace(/Roast/g, 'Feedback')
        }
      })
    }

    // Run initially and set up observer for dynamically loaded content
    if (isEnabled) {
      const timer = setTimeout(replaceRoastText, 100)
      const interval = setInterval(replaceRoastText, 500)

      return () => {
        clearTimeout(timer)
        clearInterval(interval)
      }
    }
  }, [isEnabled])

  // If feedback is disabled, just render children without widget
  if (!isEnabled) {
    return <>{children}</>
  }

  return (
    <WidgetProvider
      mode="local"
      onFormSubmit={handleFeedbackSubmit}
      customize={{
        // Form customization
        form: {
          messageInput: {
            placeholder: 'Describe the issue, bug, or suggestion...',
            className: 'border-camp-green/20 focus:border-camp-green',
          },
          emailInput: {
            className: 'hidden', // Hide email input - we get user from JWT token
          },
          submitButton: {
            label: 'Submit Feedback',
            className:
              'bg-camp-green hover:bg-camp-green/90 text-white font-semibold',
          },
          successMessage: {
            message: 'Thank you! Your feedback has been submitted.',
            className: 'text-camp-green',
          },
          errorMessage: {
            message:
              'Failed to submit feedback. Please try again or contact support.',
            className: 'text-red-600',
          },
        },

        // Island button (floating feedback button)
        islandButton: {
          position: 'bottom-right',
          className: 'bg-camp-orange hover:bg-camp-orange/90',
          modeLabel: 'Feedback mode', // Change from "Roast mode"
          toggle: {
            openLabel: 'Send Feedback',
            closeLabel: 'Close',
            className: 'text-white font-medium',
          },
        },

        // Notifications
        notification: {
          enabled: true,
          type: 'info',
          message: 'Beta Testing Mode - Your feedback helps us improve!',
        },
      }}
    >
      {children}
    </WidgetProvider>
  )
}
