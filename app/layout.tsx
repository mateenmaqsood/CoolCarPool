import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import './globals.css'

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
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
}

/**
 * Applies the persisted theme before first paint (no flash).
 * Kept deliberately tiny and inline.
 */
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('ccp-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
