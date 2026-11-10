'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Soft pill badges. Intensity comes from color-mix() over the CSS variable —
 * works in both themes without extra tokens.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-pill border font-medium',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-elevated text-ink-secondary',
        outline: 'border border-line bg-transparent text-ink-secondary',
        /** Solid spring-green pill (selected / accent states). */
        brand: 'border-transparent bg-brand text-brand-ink font-semibold',
        success:
          'border-[color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-[var(--ok)]',
        warning:
          'border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-[var(--warn)] dark:text-[color-mix(in_srgb,var(--warn)_75%,white)]',
        danger:
          'border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]',
        /** Charcoal pill with green text — the "2 Seats Left" badge. */
        gradient: 'border-transparent bg-nav text-brand font-semibold',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface BadgeProps
  extends VariantProps<typeof badgeVariants>,
    Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  icon?: ReactNode
}

export function Badge({ className, variant, size, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </span>
  )
}

export { badgeVariants }
