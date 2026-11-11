import { Skeleton } from '@/components/ui/Skeleton'
import { TravelCardSkeleton } from '@/components/travel/TravelCardSkeleton'

/** Skeleton shown while the ride detail page's server components load. */
export default function TravelDetailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {/* Back chevron + host avatar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-72" />
      </div>

      {/* Meta chips */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-32 rounded-pill" />
        <Skeleton className="h-6 w-16 rounded-pill" />
        <Skeleton className="h-6 w-24 rounded-pill" />
      </div>

      {/* Host + stats row */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Tab pill */}
      <Skeleton className="h-11 w-full rounded-pill" />

      {/* Route map block */}
      <div style={{ height: 384, minHeight: 320, width: '100%' }}>
        <Skeleton className="h-full w-full rounded-3xl" />
      </div>

      {/* Cards below the map */}
      <div className="flex flex-col gap-4">
        <TravelCardSkeleton />
      </div>
    </div>
  )
}
