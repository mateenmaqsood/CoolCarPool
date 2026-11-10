'use client'

import { cn } from '@/lib/utils'

export interface SegmentedControlProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  className?: string
  ariaLabel?: string
}

/**
 * iOS segmented control. Sunken track, elevated active segment.
 */
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex w-full items-center gap-1 rounded-full bg-sunken p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-full py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
              active
                ? 'bg-brand text-brand-ink font-semibold shadow-soft scale-[1.02]'
                : 'text-ink-secondary hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
