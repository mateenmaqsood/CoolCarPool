'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

export interface HostedRideLite {
  id: string
  origin_text: string
  destination_text: string
}

/** Host-side "Cancel ride" — sets status='cancelled' and notifies members. */
export function CancelRideButton({ ride, compact }: { ride: HostedRideLite; compact?: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function cancel() {
    if (
      !window.confirm(
        `Cancel "${ride.origin_text} → ${ride.destination_text}"? Members will be notified and this cannot be undone.`,
      )
    ) {
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('travels').update({ status: 'cancelled' }).eq('id', ride.id)
      if (error) throw error

      // Notify every member (not the host) that the ride is off.
      const { data: members } = await supabase
        .from('travel_members')
        .select('user_id')
        .eq('travel_id', ride.id)
        .neq('is_host', true)

      if (members && members.length > 0) {
        await supabase.from('notifications').insert(
          members.map((m) => ({
            user_id: m.user_id,
            type: 'travel_cancelled',
            travel_id: ride.id,
            payload: {
              travel_origin: ride.origin_text,
              travel_destination: ride.destination_text,
            },
            read: false,
          })),
        )
      }

      toast({ title: 'Ride cancelled', description: 'Members have been notified.', variant: 'success' })
      router.refresh()
    } catch (err) {
      console.error('[cancel-ride] error:', err)
      toast({ title: 'Could not cancel ride', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size={compact ? 'sm' : 'md'}
      loading={loading}
      onClick={() => void cancel()}
      className="gap-2 text-[var(--error)] hover:border-[var(--error)] hover:text-[var(--error)]"
    >
      <Ban className="h-4 w-4" />
      Cancel ride
    </Button>
  )
}