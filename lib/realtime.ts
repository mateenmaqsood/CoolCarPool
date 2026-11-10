'use client'

/**
 * CoolCarPool — Supabase Realtime subscription helpers.
 *
 * Thin, typed wrappers around the browser client for:
 *  - `messages`        → live group chat per travel
 *  - `notifications`   → per-user in-app notification stream
 *  - `travels`         → feed passthrough (new/updated rides)
 *  - `travel_members`  → seat-map / available-seats bumps
 *
 * Usage pattern (client components):
 *
 *   useEffect(() => {
 *     const channel = subscribeToTravelMessages(travelId, {
 *       onInsert: (msg) => setMessages((prev) => [...prev, msg]),
 *     })
 *     return () => unsubscribe(channel)
 *   }, [travelId])
 *
 * Every helper returns the RealtimeChannel so the caller owns cleanup.
 * Per project guardrails, pair these with 30s polling as degraded-mode
 * fallback — realtime is an enhancement, never a gate.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Message, Notification, Travel } from '@/types'

export type Unsubscribe = () => void

// Re-export Message for consumers
export type { Message, Notification, Travel }

/** Remove + discard a channel (call in your effect's cleanup). */
export function unsubscribe(channel: RealtimeChannel | null): void {
  if (channel) {
    void channel.unsubscribe()
  }
}

/* ------------------------------------------------------------------ */
/* Messages — group chat for one travel                                */
/* ------------------------------------------------------------------ */

export interface TravelMessagesHandlers {
  /** Brand-new message (member text or system events). */
  onInsert?: (message: Message) => void
  /** Message edit — rare, but keeps transcripts honest. */
  onUpdate?: (message: Message) => void
  onDelete?: (message: Message) => void
}

export function subscribeToTravelMessages(
  travelId: string,
  handlers: TravelMessagesHandlers,
): RealtimeChannel {
  const supabase = createClient()
  const channel = supabase
    .channel(`travel-messages:${travelId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `travel_id=eq.${travelId}` },
      (payload) => handlers.onInsert?.(payload.new as Message),
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `travel_id=eq.${travelId}` },
      (payload) => handlers.onUpdate?.(payload.new as Message),
    )
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages', filter: `travel_id=eq.${travelId}` },
      (payload) => handlers.onDelete?.(payload.old as Message),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`[realtime] messages channel error for travel ${travelId}`)
      }
    })

  return channel
}

/* ------------------------------------------------------------------ */
/* Notifications — authenticated user's own stream                     */
/* ------------------------------------------------------------------ */

export interface NotificationHandlers {
  onInsert?: (notification: Notification) => void
  /** Read-state flips arrive as UPDATEs. */
  onUpdate?: (notification: Notification) => void
}

export function subscribeToUserNotifications(
  userId: string,
  handlers: NotificationHandlers,
): RealtimeChannel {
  const supabase = createClient()
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => handlers.onInsert?.(payload.new as Notification),
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => handlers.onUpdate?.(payload.new as Notification),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`[realtime] notifications channel error for user ${userId}`)
      }
    })
}

/* ------------------------------------------------------------------ */
/* Travel feed — passthrough for open travels                          */
/* ------------------------------------------------------------------ */

export interface TravelFeedHandlers {
  /** New travel posted — append to the grid without a refetch. */
  onInsert?: (travel: Travel) => void
  /** Seat-syncs, locks and merges. */
  onUpdate?: (travel: Travel) => void
}

export function subscribeToTravelFeed(handlers: TravelFeedHandlers): RealtimeChannel {
  const supabase = createClient()
  return supabase
    .channel('travel-feed')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'travels' },
      (payload) => handlers.onInsert?.(payload.new as Travel),
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'travels' },
      (payload) => handlers.onUpdate?.(payload.new as Travel),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[realtime] travel feed channel error')
      }
    })
}

/* ------------------------------------------------------------------ */
/* Travel members — seat map bumps                                     */
/* ------------------------------------------------------------------ */

export function subscribeToTravelMembers(
  travelId: string,
  handlers: { onAny?: () => void },
): RealtimeChannel {
  const supabase = createClient()
  return supabase
    .channel(`travel-members:${travelId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'travel_members', filter: `travel_id=eq.${travelId}` },
      () => handlers.onAny?.(),
    )
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'travel_members', filter: `travel_id=eq.${travelId}` },
      () => handlers.onAny?.(),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`[realtime] members channel error for travel ${travelId}`)
      }
    })
}

/** Batch cleanup for pages that open several channels. */
export function unsubscribeAll(
  channels: Array<RealtimeChannel | null>,
): Unsubscribe {
  return () => channels.forEach((c) => unsubscribe(c))
}
