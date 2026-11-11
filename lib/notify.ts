/**
 * Notification helper — fire-and-forget inserts into the notifications table.
 * Never blocks the triggering action; failures are logged, not thrown.
 */

import { createClient } from '@/lib/supabase/client'

export interface NotifyInput {
  type: string
  travelId: string | null
  payload: Record<string, unknown>
}

/** Notify a list of user ids (deduped, empties filtered). */
export async function notifyUsers(userIds: Array<string | null | undefined>, input: NotifyInput) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
  if (ids.length === 0) return
  try {
    const supabase = createClient()
    const { error } = await supabase.from('notifications').insert(
      ids.map((user_id) => ({
        user_id,
        type: input.type,
        travel_id: input.travelId,
        payload: input.payload,
        read: false,
      })),
    )
    if (error) console.warn(`[notify] insert failed (${input.type}):`, error.message)
  } catch (e) {
    console.warn(`[notify] ${input.type} failed:`, e)
  }
}

/** Fetch a travel's member user ids (optionally excluding one — e.g. the actor). */
export async function getMemberIds(travelId: string, exceptUserId?: string): Promise<string[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('travel_members')
      .select('user_id')
      .eq('travel_id', travelId)
    return (data ?? [])
      .map((row) => row.user_id as string)
      .filter((id) => id !== exceptUserId)
  } catch (e) {
    console.warn('[notify] member fetch failed:', e)
    return []
  }
}
