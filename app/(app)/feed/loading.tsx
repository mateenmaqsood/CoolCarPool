import { Skeleton } from '@/components/ui/Skeleton'
import { TravelCardSkeleton } from '@/components/travel/TravelCardSkeleton'

/** Skeleton shown while the feed's server components load. */
export default function FeedLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      {/* Greeting + avatar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      {/* Search pill */}
      <Skeleton className="h-12 w-full rounded-pill" />

      {/* Filter chips */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-16 rounded-pill" />
        <Skeleton className="h-9 w-16 rounded-pill" />
        <Skeleton className="h-9 w-16 rounded-pill" />
      </div>

      {/* Ride cards */}
      <div className="flex flex-col gap-4">
        <TravelCardSkeleton />
        <TravelCardSkeleton />
      </div>
    </div>
  )
}
