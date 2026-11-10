import { AppNav } from '@/components/nav/AppNav'

/**
 * Authenticated app shell. Middleware guarantees a session here, so the nav
 * can safely assume there is (eventually) a user to render.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:pb-12">
        {children}
      </main>
      {/* Mobile bottom tab bar (matches the reference app's bottom nav) */}
      <MobileTabBar />
    </div>
  )
}

function MobileTabBar() {
  return <AppNav variant="tabbar" />
}
