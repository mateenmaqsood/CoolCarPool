'use client'

import { cn } from '@/lib/utils'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  label?: string
}

/** iOS-style switch. Use with a visible label next to it. */
export function Toggle({ checked, onChange, disabled, className, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-brand' : 'bg-[var(--border)]',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
