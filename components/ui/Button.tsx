'use client'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        /** Spring-green pill with ink text — the mockup CTA. */
        primary: 'bg-brand text-brand-ink shadow-soft hover:bg-brand-hover',
        secondary: 'bg-card text-ink hover:bg-sunken',
        ghost: 'text-ink-secondary hover:bg-sunken hover:text-ink',
        outline: 'border-2 border-ink bg-transparent text-ink hover:bg-elevated',
        /** Charcoal pill with green text — the signup "Complete Signup" CTA. */
        ink: 'bg-nav text-brand shadow-card hover:bg-nav-hover',
        danger: 'bg-[var(--error)] text-white shadow-soft hover:opacity-90',
        /** Legacy hero-CTA variant — now the bold green sweep. */
        gradient:
          'bg-brand text-brand-ink shadow-card hover:bg-brand-hover font-bold',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-11 px-5 text-sm',
        lg: 'h-14 px-7 text-base',
        icon: 'h-11 w-11 p-0',
      },
      pill: {
        true: '',
        false: 'rounded-xl',
      },
    },
    compoundVariants: [{ size: 'icon', pill: true, className: 'rounded-full' }],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      pill: true,
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
