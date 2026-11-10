'use client'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white shadow-soft hover:bg-brand-hover',
        secondary: 'border border-line bg-elevated text-ink hover:bg-sunken',
        ghost: 'text-ink-secondary hover:bg-elevated hover:text-ink',
        outline: 'border border-line bg-transparent text-ink hover:bg-elevated',
        danger: 'bg-[var(--error)] text-white shadow-soft hover:opacity-90',
        /** Warm orange→red gradient hero CTA (matches the reference EV app). */
        gradient:
          'accent-gradient text-white shadow-card hover:brightness-110 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]',
      },
      size: {
        sm: 'h-8 rounded-lg px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
      pill: {
        true: 'rounded-pill',
        false: '',
      },
    },
    compoundVariants: [{ size: 'icon', pill: true, className: 'rounded-full' }],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      pill: false,
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, pill }), className)}
        disabled={disabled ?? loading ? true : undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
