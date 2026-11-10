import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Providers } from './providers'
import './globals.css'

/**
 * Satoshi (Fontshare, ITF Free Font License) — display-grade grotesk for the
 * mockup language: heavy tight headlines, clean UI text, tabular figures.
 */
const satoshi = localFont({
  src: [
    { path: './fonts/satoshi-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/satoshi-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/satoshi-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/satoshi-900.woff2', weight: '900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', 'arial'],
})

export const metadata: Metadata = {
  title: {
    default: 'CoolCarPool',
    template: '%s · CoolCarPool',
  },
  description:
    'Share the ride, split the fare. Pakistan-first carpooling — Lahore to Murree and everywhere between.',
  applicationName: 'CoolCarPool',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#131416' },
    { media: '(prefers-color-scheme: light)', color: '#f5f4ef' },
  ],
}

/**
 * Applies the persisted theme before first paint (no flash).
 * Light is the default per the reference mockups; dark is opt-in.
 * Kept deliberately tiny and inline.
 */
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('ccp-theme');document.documentElement.dataset.theme=t?t:'light'}catch(e){document.documentElement.dataset.theme='light'}`

/**
 * Synchronous FOUC prevention — runs before any React hydration.
 * Must be in <head> and not async/deferred.
 */
const THEME_FOUC_SCRIPT = `try{var t=localStorage.getItem('ccp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={satoshi.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
