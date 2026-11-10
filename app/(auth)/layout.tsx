import Link from 'next/link'

/**
 * Auth group shell — centered card on a sunken canvas, brand-led, no nav
 * (guests shouldn't see app navigation). Handle both guest routes.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-sunken px-4 py-10">
      {/* Brand row */}
      <Link href="/feed" className="flex items-center gap-3" aria-label="CoolCarPool home">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand shadow-card">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-4h8l3 4h1a2 2 0 012 2v6a2 2 0 01-2 2h-2" stroke="#101408" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="7.5" cy="17.5" r="2.5" stroke="#101408" strokeWidth="2"/>
            <circle cx="16.5" cy="17.5" r="2.5" stroke="#101408" strokeWidth="2"/>
          </svg>
        </span>
        <span className="text-xl font-bold tracking-tight text-ink">
          Cool<span className="text-brand">CarPool</span>
        </span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-line bg-elevated p-6 shadow-card [data-theme=dark]:shadow-float">
        {children}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-tertiary">
        Gender-verified matching · KM-based fair fare split
        <br />
        TechSOC Hackathon · Card 3 Demo Build
      </p>
    </div>
  )
}
