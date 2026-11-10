import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-secondary">Effective date: {new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <article className="prose prose-ink max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-ink">1. Service Description</h2>
          <p className="text-ink-secondary mt-2">
            CoolCarPool is a Pakistan-first carpooling platform that connects riders with hosts traveling on similar routes.
            We enable cost-sharing for fuel and tolls — not commercial transport. All rides are private arrangements between
            verified individuals.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">2. User Responsibilities</h2>
          <ul className="list-disc list-inside space-y-2 mt-2 text-ink-secondary">
            <li>Provide accurate personal information (name, gender, phone, city) during registration.</li>
            <li>Hosts must maintain valid vehicle registration, insurance, and roadworthiness.</li>
            <li>Riders must respect the host's vehicle, schedule, and house rules.</li>
            <li>No smoking, vaping, or illegal substances in any ride.</li>
            <li>Report safety concerns immediately via the in-app reporting tool.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">3. Gender Filtering & Safety</h2>
          <p className="text-ink-secondary mt-2">
            CoolCarPool offers gender-based ride filtering (Boys Only, Girls Only, Anyone) as a core safety feature.
            Gender is self-declared at signup and used solely for ride matching. We do not share gender with third parties.
            This feature exists to give users — particularly women — greater comfort and control over their carpool experience.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">4. Payment Terms</h2>
          <ul className="list-disc list-inside space-y-2 mt-2 text-ink-secondary">
            <li>All payments are cost-sharing only: fuel + tolls split by kilometers traveled.</li>
            <li>CoolCarPool does not charge platform fees on rides (hackathon build).</li>
            <li>Hosts upload fuel/toll receipts; the app calculates per-rider shares automatically.</li>
            <li>No commercial transport, no surge pricing, no hidden fees.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">5. Liability Disclaimer</h2>
          <p className="text-ink-secondary mt-2">
            CoolCarPool is a matching platform, not a transport operator. We do not employ hosts, own vehicles, or control
            driving behavior. Rides are undertaken at each participant's own risk. We are not liable for accidents, delays,
            lost items, or disputes between users. Users agree to hold CoolCarPool harmless from claims arising from rides.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">6. Account Termination</h2>
          <p className="text-ink-secondary mt-2">
            We may suspend or terminate accounts for: repeated no-shows, safety violations, harassment, fraudulent profiles,
            or violation of these Terms. Terminated users may appeal via email.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">7. Governing Law</h2>
          <p className="text-ink-secondary mt-2">
            These Terms are governed by the laws of the Islamic Republic of Pakistan. Disputes shall be resolved in the
            courts of Lahore, Punjab.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">8. Contact</h2>
          <p className="text-ink-secondary mt-2">
            Questions about these Terms? Email <a href="mailto:support@coolcarpool.pk" className="text-brand underline">support@coolcarpool.pk</a>.
          </p>
        </section>
      </article>

      <footer className="mt-12 pt-8 border-t border-line text-center text-sm text-ink-tertiary">
        <Link href="/feed" className="text-brand hover:underline">← Back to Feed</Link>
      </footer>
    </div>
  )
}