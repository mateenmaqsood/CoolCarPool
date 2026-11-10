/**
 * CoolCarPool — POST /api/merge-travel
 *
 * Handles the "Merge" action from DuplicateModal.
 * Merges candidate travel into primary travel:
 *  - Transfers pending requests to primary
 *  - Sets candidate status = 'merged', merged_into_id = primary
 *  - Notifies all affected users
 *  - Records action in duplicate_matches
 *
 * Body: { primary_id, candidate_id, action: 'merge' | 'keep' }
 * Response: { ok, travel_id }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: { primary_id: string; candidate_id: string; action: 'merge' | 'keep' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { primary_id, candidate_id, action } = body

  if (!primary_id || !candidate_id || !action) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
  }

  if (action === 'keep') {
    // Just record the decision
    await supabase.from('duplicate_matches').upsert({
      primary_id,
      candidate_id,
      action: 'kept',
      resolved_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, travel_id: primary_id })
  }

  // Action is 'merge' - verify user is host of primary
  const { data: primaryTravel, error: primaryError } = await supabase
    .from('travels')
    .select('host_id')
    .eq('id', primary_id)
    .single()

  if (primaryError || !primaryTravel) {
    return NextResponse.json({ ok: false, error: 'Primary travel not found' }, { status: 404 })
  }

  if (primaryTravel.host_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Only host of primary travel can merge' }, { status: 403 })
  }

  try {
    // 1. Get candidate travel details
    const { data: candidateTravel, error: candidateError } = await supabase
      .from('travels')
      .select('*')
      .eq('id', candidate_id)
      .single()

    if (candidateError || !candidateTravel) {
      return NextResponse.json({ ok: false, error: 'Candidate travel not found' }, { status: 404 })
    }

    // 2. Transfer pending requests from candidate to primary
    const { data: pendingRequests, error: reqError } = await supabase
      .from('travel_requests')
      .select('*')
      .eq('travel_id', candidate_id)
      .eq('status', 'pending')

    if (reqError) throw reqError

    if (pendingRequests && pendingRequests.length > 0) {
      const transfers = pendingRequests.map((req) => ({
        travel_id: primary_id,
        requester_id: req.requester_id,
        waypoint_id: req.waypoint_id,
        km_from_origin: req.km_from_origin,
        message: req.message,
        status: 'pending',
      }))

      const { error: insertError } = await supabase.from('travel_requests').insert(transfers)
      if (insertError) throw insertError
    }

    // 3. Mark candidate as merged
    const { error: updateError } = await supabase
      .from('travels')
      .update({
        status: 'merged',
        merged_into_id: primary_id,
      })
      .eq('id', candidate_id)

    if (updateError) throw updateError

    // 4. Notify candidate host
    await supabase.from('notifications').insert({
      user_id: candidateTravel.host_id,
      type: 'travel_merged',
      travel_id: primary_id,
      payload: {
        candidate_id: candidate_id,
        primary_id: primary_id,
        message: `Your travel "${candidateTravel.origin_text} → ${candidateTravel.destination_text}" was merged into another ride.`,
      },
    })

    // 5. Notify candidate's pending requesters
    if (pendingRequests && pendingRequests.length > 0) {
      const notifications = pendingRequests.map((req) => ({
        user_id: req.requester_id,
        type: 'request_received',
        travel_id: primary_id,
        payload: {
          message: `Your join request was transferred to a merged ride: ${candidateTravel.origin_text} → ${candidateTravel.destination_text}`,
        },
      }))
      await supabase.from('notifications').insert(notifications)
    }

    // 6. Notify primary travel members
    const { data: primaryMembers } = await supabase
      .from('travel_members')
      .select('user_id')
      .eq('travel_id', primary_id)

    if (primaryMembers) {
      const memberNotifications = primaryMembers
        .filter((m) => m.user_id !== user.id) // Don't notify the host who initiated
        .map((m) => ({
          user_id: m.user_id,
          type: 'travel_merged',
          travel_id: primary_id,
          payload: {
            message: `A similar ride was merged into this travel. More seats may be available.`,
          },
        }))

      if (memberNotifications.length > 0) {
        await supabase.from('notifications').insert(memberNotifications)
      }
    }

    // 7. Record merge in duplicate_matches
    await supabase.from('duplicate_matches').upsert({
      primary_id,
      candidate_id,
      action: 'merged',
      resolved_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, travel_id: primary_id })
  } catch (error) {
    console.error('[merge-travel] error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to merge travels' }, { status: 500 })
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
}