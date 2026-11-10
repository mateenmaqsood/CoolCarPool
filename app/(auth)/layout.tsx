import Image from 'next/image'
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
        <span className="overflow-hidden rounded-2xl shadow-card">
          <Image src="/logo.jpeg" alt="" width={48} height={48} priority className="h-12 w-12 object-cover" />
        </span>
        <span className="text-xl font-bold tracking-tight text-ink">
          Cool<span className="accent-text-gradient">CarPool</span>
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
