/**
 * Terms of Service Page
 * Required for Google OAuth approval and legal compliance
 */

import Link from 'next/link'
import { TreePine, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | CAMP FASD',
  description: 'Terms of Service for CAMP FASD Application Portal',
}

export default function TermsOfServicePage() {
  const lastUpdated = 'December 30, 2025'
  const contactEmail = 'support@fasdcamp.org'

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
          <h1 className="text-3xl font-bold text-camp-charcoal mb-2">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last Updated: {lastUpdated}</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 mb-4">
                Welcome to the CAMP FASD Application Portal (the "Service"), operated by CAMP – A FASD Community
                ("CAMP FASD," "we," "us," or "our"). By accessing or using the Service, you ("User," "you," or "your")
                agree to be bound by these Terms of Service ("Terms").
              </p>
              <p className="text-gray-600">
                If you do not agree to these Terms, you may not access or use the Service. If you are using the Service
                on behalf of a minor (as a parent or legal guardian), you agree to these Terms on behalf of yourself
                and the minor.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">2. Description of Service</h2>
              <p className="text-gray-600 mb-4">
                The CAMP FASD Application Portal is an online platform that enables families to:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Submit and manage camper registration applications</li>
                <li>Provide required medical, behavioral, and personal information</li>
                <li>Upload necessary documents and forms</li>
                <li>Track application status and communicate with camp administrators</li>
                <li>Process registration payments</li>
                <li>Receive important notifications and updates about camp</li>
              </ul>
              <p className="text-gray-600 mt-4">
                The Service is intended for use by families seeking to register campers for CAMP FASD programs and by
                authorized camp staff for administration purposes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">3. User Accounts</h2>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">3.1 Account Creation</h3>
              <p className="text-gray-600 mb-4">
                To use the Service, you must create an account by providing accurate and complete information. You may
                register using an email address and password or through Google OAuth authentication.
              </p>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">3.2 Account Responsibilities</h3>
              <p className="text-gray-600 mb-3">You are responsible for:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
                <li>Ensuring all information provided is accurate, current, and complete</li>
              </ul>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">3.3 Account Termination</h3>
              <p className="text-gray-600">
                We reserve the right to suspend or terminate your account at any time for violation of these Terms,
                provision of false information, or any other reason we deem appropriate. You may also request account
                deletion by contacting us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">4. Application Process</h2>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">4.1 Application Submission</h3>
              <p className="text-gray-600 mb-4">
                Submitting an application through the Service does not guarantee acceptance into CAMP FASD programs.
                All applications are subject to review by camp administrators, and acceptance decisions are made at
                the sole discretion of CAMP FASD based on factors including camper needs, available resources, and
                program capacity.
              </p>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">4.2 Information Accuracy</h3>
              <p className="text-gray-600 mb-4">
                You represent and warrant that all information provided in your application is true, accurate, and
                complete. Providing false or misleading information may result in application rejection, removal from
                camp programs, and/or account termination.
              </p>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">4.3 Medical and Behavioral Information</h3>
              <p className="text-gray-600">
                Complete and accurate disclosure of medical conditions, medications, allergies, behavioral needs, and
                other health-related information is essential for the safety and well-being of your camper. Failure to
                disclose relevant information may endanger your camper and others and may result in dismissal from camp
                without refund.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">5. Fees and Payments</h2>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">5.1 Registration Fees</h3>
              <p className="text-gray-600 mb-4">
                Registration fees and payment deadlines will be communicated during the application process. Acceptance
                into camp programs is contingent upon payment of applicable fees by the stated deadlines.
              </p>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">5.2 Payment Processing</h3>
              <p className="text-gray-600 mb-4">
                Payments are processed through secure third-party payment processors. By submitting payment, you agree
                to the terms and conditions of the payment processor.
              </p>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">5.3 Refund Policy</h3>
              <p className="text-gray-600">
                Refund policies vary by program and will be communicated at the time of registration. Generally, refunds
                are available if cancellation occurs before specified deadlines. No refunds are provided for dismissals
                due to policy violations or undisclosed information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">6. Acceptable Use</h2>
              <p className="text-gray-600 mb-3">You agree not to use the Service to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Submit false, misleading, or fraudulent information</li>
                <li>Impersonate any person or entity</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Use the Service for any purpose other than its intended use</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Harvest or collect information about other users</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">7. Intellectual Property</h2>
              <p className="text-gray-600 mb-4">
                The Service, including its content, features, and functionality, is owned by CAMP FASD and is protected
                by copyright, trademark, and other intellectual property laws. You may not reproduce, distribute,
                modify, or create derivative works of any part of the Service without our express written permission.
              </p>
              <p className="text-gray-600">
                By uploading content to the Service (such as documents or photos), you grant CAMP FASD a non-exclusive,
                royalty-free license to use, store, and process that content for the purpose of providing the Service
                and operating camp programs.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">8. Privacy</h2>
              <p className="text-gray-600">
                Your privacy is important to us. Our collection, use, and disclosure of personal information is governed
                by our <Link href="/privacy" className="text-camp-green hover:text-camp-orange">Privacy Policy</Link>,
                which is incorporated into these Terms by reference. By using the Service, you consent to our data
                practices as described in the Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">9. Disclaimers</h2>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">9.1 Service Availability</h3>
              <p className="text-gray-600 mb-4">
                The Service is provided "as is" and "as available" without warranties of any kind, either express or
                implied. We do not warrant that the Service will be uninterrupted, error-free, or secure.
              </p>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">9.2 No Medical Advice</h3>
              <p className="text-gray-600 mb-4">
                The Service is an administrative tool for camp registration and is not a substitute for professional
                medical advice, diagnosis, or treatment. Always seek the advice of qualified health providers with any
                questions regarding medical conditions.
              </p>

              <h3 className="text-lg font-medium text-camp-charcoal mt-6 mb-3">9.3 Camp Activities</h3>
              <p className="text-gray-600">
                Participation in camp activities involves inherent risks. Separate waivers and agreements related to
                camp participation may be required and will be provided during the registration process.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">10. Limitation of Liability</h2>
              <p className="text-gray-600 mb-4">
                To the fullest extent permitted by law, CAMP FASD and its officers, directors, employees, and volunteers
                shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising
                out of or related to your use of the Service.
              </p>
              <p className="text-gray-600">
                Our total liability for any claims arising from these Terms or your use of the Service shall not exceed
                the amount you paid to us in the twelve (12) months preceding the claim.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">11. Indemnification</h2>
              <p className="text-gray-600">
                You agree to indemnify, defend, and hold harmless CAMP FASD and its officers, directors, employees,
                and volunteers from any claims, damages, losses, liabilities, and expenses (including reasonable
                attorney's fees) arising out of or related to your use of the Service, violation of these Terms, or
                violation of any rights of a third party.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">12. Modifications to Service and Terms</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to modify or discontinue the Service at any time without notice. We may also
                revise these Terms from time to time. Material changes will be communicated through the Service or
                via email.
              </p>
              <p className="text-gray-600">
                Your continued use of the Service after any changes constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">13. Governing Law and Disputes</h2>
              <p className="text-gray-600 mb-4">
                These Terms shall be governed by and construed in accordance with the laws of the state in which
                CAMP FASD is organized, without regard to its conflict of law provisions.
              </p>
              <p className="text-gray-600">
                Any disputes arising from these Terms or your use of the Service shall be resolved through good-faith
                negotiation. If negotiation fails, disputes shall be submitted to binding arbitration in accordance
                with applicable arbitration rules.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">14. Severability</h2>
              <p className="text-gray-600">
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be
                limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in
                full force and effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">15. Entire Agreement</h2>
              <p className="text-gray-600">
                These Terms, together with our Privacy Policy and any other agreements or policies referenced herein,
                constitute the entire agreement between you and CAMP FASD regarding the Service and supersede all
                prior agreements and understandings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-camp-charcoal mb-4">16. Contact Information</h2>
              <p className="text-gray-600 mb-4">
                If you have any questions about these Terms of Service, please contact us:
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
          <Link href="/privacy" className="text-camp-green hover:text-camp-orange transition-colors">
            View Privacy Policy
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/" className="hover:text-camp-green transition-colors">Home</Link>
              <Link href="/terms" className="text-camp-green">Terms</Link>
              <Link href="/privacy" className="hover:text-camp-green transition-colors">Privacy Policy</Link>
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
