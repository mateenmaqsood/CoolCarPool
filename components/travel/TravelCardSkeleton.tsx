import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

/**
 * Skeleton matching TravelCard's exact layout — avatar + name/time, dashed
 * route line, meta badges, and the green CTA placeholder.
 */
export function TravelCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-soft',
        className
      )}
      aria-busy="true"
      aria-label="Loading ride"
    >
      {/* Host row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-6 w-14 rounded-pill" />
      </div>

      {/* Route line */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-16" />
        <span className="relative mx-1 flex flex-1 items-center">
          <span className="h-px w-full border-t border-dashed border-line" />
        </span>
        <Skeleton className="h-3.5 w-16" />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-28 rounded-pill" />
        <Skeleton className="h-3.5 w-16" />
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-8 w-24 rounded-pill" />
      </div>
    </div>
  )
}
