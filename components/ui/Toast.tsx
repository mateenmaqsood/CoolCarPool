'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'default' | 'success' | 'warning' | 'error'

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  durationMs?: number
}

interface ToastItem extends Required<Omit<ToastOptions, 'description' | 'durationMs'>> {
  id: number
  description?: string
  durationMs: number
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof Info; className: string; iconClassName: string }> = {
  default: { icon: Info, className: 'bg-elevated', iconClassName: 'text-ink-secondary' },
  success: {
    icon: CheckCircle2,
    className: 'bg-elevated',
    iconClassName: 'text-[var(--ok)]',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-elevated',
    iconClassName: 'text-warn',
  },
  error: {
    icon: XCircle,
    className: 'bg-elevated',
    iconClassName: 'text-[var(--error)]',
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    ({ title, description, variant = 'default', durationMs = 4000 }: ToastOptions) => {
      const id = nextId.current++
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant, durationMs }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs),
      )
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const { icon: Icon, className, iconClassName } = VARIANT_STYLES[t.variant]
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-3xl p-4 shadow-float animate-slide-in-right',
                className,
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconClassName)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{t.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-full p-1 text-ink-tertiary transition-colors hover:bg-sunken hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
