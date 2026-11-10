'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = window.localStorage.getItem('ccp-theme')
    return stored === 'light' ? 'light' : 'dark' // default: dark (reference UI)
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem('ccp-theme', theme)
  } catch {
    // private mode — attribute is applied for this session at least
  }
}

function ThemeProvider({ children }: { children: ReactNode }) {
  // Server + hydration start at 'dark'; a blocking inline script in the root
  // layout applies the stored theme before paint, so no flash occurs.
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(readStoredTheme())
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const value = {
    theme,
    setTheme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  } satisfies ThemeContextValue

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside Providers')
  return ctx
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  )
}
