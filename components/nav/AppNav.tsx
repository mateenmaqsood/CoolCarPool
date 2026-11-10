'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CalendarPlus, LayoutList, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/app/providers'
import type { Profile } from '@/types'
import { cn } from '@/lib/utils'

interface AppNavProps {
  variant?: 'topbar' | 'tabbar'
}

const NAV_LINKS = [
  { href: '/feed', label: 'Feed', icon: LayoutList },
  { href: '/host', label: 'Host', icon: CalendarPlus },
  { href: '/profile', label: 'Profile', icon: UserRound },
] as const

export function AppNav({ variant = 'topbar' }: AppNavProps) {
  if (variant === 'tabbar') return <TabBar />
  return <TopBar />
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutList; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold transition-all duration-150',
        active
          ? 'bg-nav text-brand'
          : 'text-ink-secondary hover:bg-card hover:text-ink',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

function TopBar() {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (!cancelled) setProfile((data as Profile) ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return (
    <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
        {/* Brand */}
        <Link href="/feed" className="flex items-center gap-2.5" aria-label="CoolCarPool home">
          <span className="overflow-hidden rounded-xl shadow-soft">
            <Image src="/logo.jpeg" alt="CoolCarPool logo" width={36} height={36} priority className="h-9 w-9 object-cover" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-ink">
            Cool<span className="accent-text-gradient">CarPool</span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
            />
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <ThemeButton theme={theme} onToggle={toggleTheme} />
          <UserMenu
            className="hidden md:flex"
            name={profile?.full_name ?? ''}
            avatarUrl={profile?.avatar_url ?? null}
          />
        </div>
      </div>
    </header>
  )
}

function ThemeButton({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-ink-secondary transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function UserMenu({ name, avatarUrl, className }: { name: string; avatarUrl: string | null; className?: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className={cn('relative items-center', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      >
        <Avatar name={name || 'Traveler'} src={avatarUrl} size="sm" presence="online" />
      </button>

      {open ? (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-3xl bg-elevated p-1.5 shadow-float animate-scale-in">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
            >
              <UserRound className="h-4 w-4" />
              Profile
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--error)] transition-colors hover:bg-sunken"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Floating charcoal pill tab bar for mobile — the mockup's bottom nav. */
function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-6 md:hidden"
    >
      <div className="flex items-center gap-1 rounded-pill bg-nav p-1.5 shadow-float">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex w-[4.5rem] flex-col items-center gap-0.5 rounded-pill py-2 transition-colors duration-150',
                active ? 'bg-nav-hover text-brand' : 'text-ink-tertiary hover:text-white',
              )}
            >
              <link.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[9px] font-semibold tracking-wide">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
