/**
 * Privacy Policy Page
 * Required for Google OAuth approval and user transparency
 */

import Link from 'next/link'
import { TreePine, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | CAMP FASD',
  description: 'Privacy Policy for CAMP FASD Application Portal',
}

export default function PrivacyPolicyPage() {
  const lastUpdated = 'December 30, 2025'
  const contactEmail = 'privacy@fasdcamp.org'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-camp-green hover:text-camp-orange transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <TreePine className="h-6 w-6" />
            <span className="font-semibold">CAMP FASD</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-camp-charcoal mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last Updated: {lastUpdated}</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">1. Introduction</h2>
              <p className="text-gray-600 mb-4">
                CAMP – A FASD Community ("CAMP FASD," "we," "us," or "our") operates the CAMP FASD Application Portal
                (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your
                information when you use our Service.
              </p>
              <p className="text-gray-600">
                We are committed to protecting the privacy of our campers, their families, and all users of our Service.
                Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of
                information in accordance with this policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">2. Information We Collect</h2>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">2.1 Personal Information</h3>
              <p className="text-gray-600 mb-3">We collect information that you voluntarily provide when registering for and using the Service, including:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Account Information:</strong> Name, email address, phone number, and password</li>
                <li><strong>Camper Information:</strong> Camper's name, date of birth, gender, school information, and profile photo</li>
                <li><strong>Medical Information:</strong> Medications, allergies, medical conditions, FASD diagnosis details, healthcare provider information, and emergency contacts</li>
                <li><strong>Behavioral Information:</strong> Behavioral assessments, support needs, triggers, and calming strategies</li>
                <li><strong>Guardian Information:</strong> Parent/guardian names, contact information, and relationship to camper</li>
                <li><strong>Payment Information:</strong> Billing address and payment details (processed securely through third-party payment processors)</li>
                <li><strong>Documents:</strong> Uploaded files such as medical forms, immunization records, and signed agreements</li>
              </ul>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">2.2 Automatically Collected Information</h3>
              <p className="text-gray-600 mb-3">When you access our Service, we may automatically collect:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                <li><strong>Usage Data:</strong> Pages visited, time spent on pages, and interaction patterns</li>
                <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
              </ul>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">2.3 Information from Third Parties</h3>
              <p className="text-gray-600">
                If you choose to sign in using Google OAuth, we receive your name and email address from Google.
                We do not receive or store your Google password.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-600 mb-3">We use the collected information for the following purposes:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Camp Operations:</strong> To process applications, manage registrations, and prepare for camper attendance</li>
                <li><strong>Health and Safety:</strong> To ensure appropriate medical care, accommodations, and support for campers</li>
                <li><strong>Communication:</strong> To send application updates, payment reminders, camp information, and important announcements</li>
                <li><strong>Payment Processing:</strong> To process registration fees and manage billing</li>
                <li><strong>Service Improvement:</strong> To analyze usage patterns and improve our Service</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
                <li><strong>Emergency Response:</strong> To contact guardians and medical providers in case of emergencies</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">4. Information Sharing and Disclosure</h2>
              <p className="text-gray-600 mb-3">We may share your information in the following circumstances:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Camp Staff:</strong> Authorized staff members who need access to provide appropriate care and supervision</li>
                <li><strong>Medical Professionals:</strong> Healthcare providers in case of medical emergencies</li>
                <li><strong>Service Providers:</strong> Third-party vendors who assist in operating our Service (hosting, payment processing, email services)</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority</li>
                <li><strong>Safety:</strong> To protect the safety of campers, staff, or others</li>
              </ul>
              <p className="text-gray-600 mt-4">
                We do not sell, rent, or trade your personal information to third parties for marketing purposes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">5. Data Security</h2>
              <p className="text-gray-600 mb-4">
                We implement appropriate technical and organizational security measures to protect your personal information, including:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Encryption of data in transit using SSL/TLS</li>
                <li>Secure data storage with access controls</li>
                <li>Regular security assessments and updates</li>
                <li>Limited access to personal information on a need-to-know basis</li>
                <li>Secure authentication mechanisms</li>
              </ul>
              <p className="text-gray-600 mt-4">
                While we strive to protect your information, no method of transmission over the Internet or electronic
                storage is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">6. Data Retention</h2>
              <p className="text-gray-600">
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this
                Privacy Policy, unless a longer retention period is required or permitted by law. Camper records may be
                retained for multiple camp seasons to facilitate returning camper registrations and to maintain
                historical health and safety records. You may request deletion of your data by contacting us at the
                email address provided below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">7. Children's Privacy</h2>
              <p className="text-gray-600 mb-4">
                Our Service collects information about children (campers) as part of the camp registration process.
                This information is provided by parents or legal guardians, not directly by children. We take special
                care to protect children's information and only collect what is necessary for camp operations, health,
                and safety.
              </p>
              <p className="text-gray-600">
                Parents and guardians have the right to review, update, or request deletion of their child's information
                by contacting us. We do not knowingly collect information directly from children under 13 without
                parental consent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">8. Your Rights and Choices</h2>
              <p className="text-gray-600 mb-3">You have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal retention requirements</li>
                <li><strong>Opt-out:</strong> Opt out of non-essential communications through your account settings</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent for processing where consent is the legal basis</li>
              </ul>
              <p className="text-gray-600 mt-4">
                To exercise these rights, please contact us at {contactEmail}.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">9. Third-Party Services</h2>
              <p className="text-gray-600 mb-3">Our Service uses the following third-party services:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><strong>Supabase:</strong> Database hosting and authentication services</li>
                <li><strong>Google OAuth:</strong> Optional sign-in authentication</li>
                <li><strong>Stripe:</strong> Payment processing (when applicable)</li>
                <li><strong>Resend:</strong> Email delivery services</li>
              </ul>
              <p className="text-gray-600 mt-4">
                These services have their own privacy policies governing their use of your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">10. Cookies and Tracking</h2>
              <p className="text-gray-600">
                We use essential cookies to maintain your session and provide core functionality. We do not use
                advertising cookies or third-party tracking cookies. You can configure your browser to refuse cookies,
                but this may limit your ability to use certain features of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">11. Changes to This Privacy Policy</h2>
              <p className="text-gray-600">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by
                posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to
                review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">12. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 font-medium">CAMP – A FASD Community</p>
                <p className="text-gray-600">Email: {contactEmail}</p>
                <p className="text-gray-600">Website: <a href="https://fasdcamp.org" className="text-camp-green hover:text-camp-orange">fasdcamp.org</a></p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <Link href="/terms" className="text-camp-green hover:text-camp-orange transition-colors">
            View Terms of Service
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/" className="hover:text-camp-green transition-colors">Home</Link>
              <Link href="/terms" className="hover:text-camp-green transition-colors">Terms</Link>
              <Link href="/privacy" className="text-camp-green">Privacy Policy</Link>
            </div>
            <p className="text-center text-sm text-gray-500">
              © {new Date().getFullYear()} CAMP – A FASD Community. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
