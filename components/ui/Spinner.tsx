import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const

export interface SpinnerProps {
  size?: keyof typeof SIZES
  className?: string
  label?: string
}

/** Shared loading spinner — one consistent animation across the app. */
export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-brand', SIZES[size], className)}
      aria-busy="true"
      aria-label={label ?? 'Loading'}
    />
  )
}
