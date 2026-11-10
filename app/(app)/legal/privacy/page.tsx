import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-secondary">Effective date: {new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <article className="prose prose-ink max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-ink">1. Data We Collect</h2>
          <p className="text-ink-secondary mt-2">We collect only what is necessary to run a safe, fair carpooling service:</p>
          <ul className="list-disc list-inside space-y-2 mt-2 text-ink-secondary">
            <li><strong>Account data:</strong> Full name, email, password (hashed), gender, city, phone number.</li>
            <li><strong>Profile data:</strong> Avatar photo, vehicle make/model/color/plate (optional, host-only).</li>
            <li><strong>Ride data:</strong> Origin, destination, waypoints, departure time, seats, cost, gender preference.</li>
            <li><strong>Usage data:</strong> Session cookies, device info, IP address (for fraud prevention).</li>
            <li><strong>Communications:</strong> In-app chat messages, join requests, notifications.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">2. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-2 mt-2 text-ink-secondary">
            <li><strong>Ride matching:</strong> Gender, route, time, and preferences to show relevant rides.</li>
            <li><strong>Fair fare calculation:</strong> Kilometers traveled x PKR 20/km minimum, split by occupancy.</li>
            <li><strong>Identity verification:</strong> Gender and phone for trust between co-travelers.</li>
            <li><strong>Safety & moderation:</strong> Chat logs and reports reviewed for harassment or fraud.</li>
            <li><strong>Service improvement:</strong> Anonymous analytics on ride completion, search patterns.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">3. Data Sharing</h2>
          <p className="text-ink-secondary mt-2">
            Your phone number is visible <strong>only</strong> to the host and co-riders <strong>after</strong> your join request is accepted.
            We do not sell data. We do not share data with advertisers. Aggregated, anonymous statistics may be published
            in hackathon demos or blog posts (e.g., "5,000 km carpooled this month").
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">4. Data Retention</h2>
          <ul className="list-disc list-inside space-y-2 mt-2 text-ink-secondary">
            <li>Account data: retained until you request deletion.</li>
            <li>Ride history & chat logs: retained for 2 years for dispute resolution.</li>
            <li>Session cookies: expire after 30 days of inactivity.</li>
            <li>Deleted accounts: all personal data purged within 30 days (ride history anonymized).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">5. Your Rights</h2>
          <p className="text-ink-secondary mt-2">
            Under applicable law, you may request: access to your data, correction of inaccuracies, deletion of your account,
            or a portable copy of your data. Email <a href="mailto:privacy@coolcarpool.pk" className="text-brand underline">privacy@coolcarpool.pk</a>
            with "Privacy Request" in the subject line. We respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">6. Security</h2>
          <p className="text-ink-secondary mt-2">
            Passwords are bcrypt-hashed. All traffic uses HTTPS. Biometric credentials (Face ID / Touch ID) never leave
            your device - only a local credential ID is stored. Avatars are stored in Supabase Storage with signed URLs.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-ink">7. Contact</h2>
          <p className="text-ink-secondary mt-2">
            Privacy questions? Email <a href="mailto:privacy@coolcarpool.pk" className="text-brand underline">privacy@coolcarpool.pk</a>.
          </p>
        </section>
      </article>

      <footer className="mt-12 pt-8 border-t border-line text-center text-sm text-ink-tertiary">
        <Link href="/feed" className="text-brand hover:underline">Back to Feed</Link>
      </footer>
    </div>
  )
}