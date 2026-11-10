import { cn } from '@/lib/utils'

/** Shimmering placeholder block. Size it entirely via className. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-elevated', className)}>
      <div
        aria-hidden
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--fg-secondary)_16%,transparent)] to-transparent"
      />
    </div>
  )
}

/** Standard multi-line text placeholder. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}
