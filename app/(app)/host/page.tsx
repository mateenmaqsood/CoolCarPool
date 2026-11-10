import { TravelForm } from '@/components/travel/TravelForm'

export const metadata = { title: 'Host a Travel' }

/** /host — the 4-step wizard. Middleware guarantees an authenticated host. */
export default function HostPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <TravelForm />
    </div>
  )
}
