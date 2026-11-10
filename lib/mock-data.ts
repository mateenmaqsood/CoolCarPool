import type { Travel, Profile, BillSlip, TravelMember, Message } from '@/types'

/**
 * Demo fallback data — used by the ride feed when Supabase fails or is empty
 * (per the project guardrails). Shapes mirror the DB rows 1:1.
 */

export interface FeedHost {
  id: string
  full_name: string
  avatar_url: string | null
}

export interface FeedTravel extends Travel {
  host?: FeedHost | null
}

export const MOCK_HOSTS = {
  ali: {
    id: 'USER_A_ID',
    full_name: 'Ali Hassan',
    avatar_url: null,
  },
  sara: {
    id: 'USER_B_ID',
    full_name: 'Sara Khan',
    avatar_url: null,
  },
  usman: {
    id: 'USER_C_ID',
    full_name: 'Usman Tariq',
    avatar_url: null,
  },
} satisfies Record<string, FeedHost>

function inDays(days: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/**
 * The seed-data travel pair: TRAVEL_A and TRAVEL_B are deliberately
 * near-duplicates (same route, 55 minutes apart) for the Duplicate Detector
 * demo, plus two filler rides for a lively feed.
 */
export const MOCK_TRAVELS: FeedTravel[] = [
  {
    id: 'TRAVEL_A',
    host_id: MOCK_HOSTS.ali.id,
    origin_text: 'Lahore',
    origin_lat: 31.5204,
    origin_lng: 74.3587,
    destination_text: 'Murree',
    destination_lat: 33.9066,
    destination_lng: 73.3927,
    total_km: 310,
    departure_at: inDays(2, 9),
    is_recurring: false,
    recurring_days: null,
    total_seats: 4,
    available_seats: 3,
    gender_preference: 'boys_only',
    pickup_radius_km: 2,
    estimated_cost_pkr: 2500,
    description: 'Hill trip! Chill vibes, no smoking. Fuel split at the end.',
    status: 'open',
    merged_into_id: null,
    created_at: new Date().toISOString(),
    host: MOCK_HOSTS.ali,
  },
  {
    id: 'TRAVEL_B',
    host_id: MOCK_HOSTS.usman.id,
    origin_text: 'Lahore',
    origin_lat: 31.5204,
    origin_lng: 74.3587,
    destination_text: 'Murree',
    destination_lat: 33.9066,
    destination_lng: 73.3927,
    total_km: 310,
    departure_at: inDays(2, 9, 55),
    is_recurring: false,
    recurring_days: null,
    total_seats: 4,
    available_seats: 4,
    gender_preference: 'any',
    pickup_radius_km: 1,
    estimated_cost_pkr: 2800,
    description: 'Family-friendly ride, leaving sharp on time.',
    status: 'open',
    merged_into_id: null,
    created_at: new Date().toISOString(),
    host: MOCK_HOSTS.usman,
  },
  {
    id: 'TRAVEL_C',
    host_id: MOCK_HOSTS.sara.id,
    origin_text: 'Islamabad',
    origin_lat: 33.6844,
    origin_lng: 73.0479,
    destination_text: 'Murree',
    destination_lat: 33.9066,
    destination_lng: 73.3927,
    total_km: 60,
    departure_at: inDays(1, 10),
    is_recurring: false,
    recurring_days: null,
    total_seats: 3,
    available_seats: 2,
    gender_preference: 'girls_only',
    pickup_radius_km: 2,
    estimated_cost_pkr: 800,
    description: 'Quick evening hill run, back before Maghrib.',
    status: 'open',
    merged_into_id: null,
    created_at: new Date().toISOString(),
    host: MOCK_HOSTS.sara,
  },
  {
    id: 'TRAVEL_D',
    host_id: MOCK_HOSTS.usman.id,
    origin_text: 'Lahore',
    origin_lat: 31.5204,
    origin_lng: 74.3587,
    destination_text: 'Islamabad',
    destination_lat: 33.6844,
    destination_lng: 73.0479,
    total_km: 280,
    departure_at: inDays(3, 7),
    is_recurring: true,
    recurring_days: ['Fri', 'Sun'],
    total_seats: 3,
    available_seats: 1,
    gender_preference: 'any',
    pickup_radius_km: 3,
    estimated_cost_pkr: 1800,
    description: 'Weekly commuter run — I do this every Fri & Sun.',
    status: 'open',
    merged_into_id: null,
    created_at: new Date().toISOString(),
    host: MOCK_HOSTS.usman,
  },
  {
    id: 'TRAVEL_E',
    host_id: MOCK_HOSTS.ali.id,
    origin_text: 'Lahore',
    origin_lat: 31.5204,
    origin_lng: 74.3587,
    destination_text: 'Nathia Gali',
    destination_lat: 34.0711,
    destination_lng: 73.3786,
    total_km: 270,
    departure_at: inDays(5, 6),
    is_recurring: false,
    recurring_days: null,
    total_seats: 5,
    available_seats: 5,
    gender_preference: 'boys_only',
    pickup_radius_km: 2,
    estimated_cost_pkr: 2200,
    description: 'Long hill drive — good playlist required, 2 stops planned.',
    status: 'open',
    merged_into_id: null,
    created_at: new Date().toISOString(),
    host: MOCK_HOSTS.ali,
  },
]

/**
 * Mock profiles matching MOCK_HOSTS for chat/member list fallbacks.
 */
export const MOCK_PROFILES: Profile[] = [
  {
    id: 'USER_A_ID',
    full_name: 'Ali Hassan',
    gender: 'male',
    phone: '+923001234567',
    city: 'Lahore',
    avatar_url: null,
    vehicle_make: 'Toyota',
    vehicle_model: 'Corolla',
    vehicle_color: 'White',
    vehicle_plate: 'LEA-1234',
    phone_verified: true,
    email_verified: true,
    created_at: new Date('2026-01-15').toISOString(),
  },
  {
    id: 'USER_B_ID',
    full_name: 'Sara Khan',
    gender: 'female',
    phone: '+923007654321',
    city: 'Islamabad',
    avatar_url: null,
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    vehicle_color: 'Silver',
    vehicle_plate: 'ISB-5678',
    phone_verified: true,
    email_verified: true,
    created_at: new Date('2026-02-20').toISOString(),
  },
  {
    id: 'USER_C_ID',
    full_name: 'Usman Tariq',
    gender: 'male',
    phone: '+923009876543',
    city: 'Lahore',
    avatar_url: null,
    vehicle_make: 'Suzuki',
    vehicle_model: 'Cultus',
    vehicle_color: 'Black',
    vehicle_plate: 'LHR-9012',
    phone_verified: false,
    email_verified: true,
    created_at: new Date('2026-03-10').toISOString(),
  },
]

/**
 * Example bill slip produced by the fare engine for TRAVEL_A with a mid-route
 * rider joining at Islamabad Toll Plaza (km 280). Total: 310 km, PKR 2500.
 */
export const MOCK_BILL_SLIP: BillSlip = {
  id: 'BILL_SLIP_MOCK_1',
  travel_id: 'TRAVEL_A',
  uploaded_by: 'USER_A_ID',
  storage_path: 'bill-slips/TRAVEL_A/mock-receipt.jpeg',
  total_pkr: 2500,
  total_km: 310,
  breakdown: {
    per_km_rate_pkr: 8.06,
    mid_route_total_pkr: 242,
    remaining_bill_pkr: 2258,
    full_route_fare_head_pkr: 1129,
    members: [
      { userId: 'USER_A_ID', fullName: 'Ali Hassan', isHost: true, isFullRoute: true, kmCovered: 310, farePkr: 1129, sharePercentage: 45.2 },
      { userId: 'USER_B_ID', fullName: 'Sara Khan', isHost: false, isFullRoute: false, kmCovered: 30, farePkr: 242, sharePercentage: 9.7 },
      { userId: 'USER_C_ID', fullName: 'Usman Tariq', isHost: false, isFullRoute: true, kmCovered: 310, farePkr: 1129, sharePercentage: 45.2 },
    ],
    total_allocated_pkr: 2500,
    rounding_pkr: 0,
    ocr_source: 'manual',
  },
  acknowledged_by: ['USER_A_ID'],
  created_at: new Date().toISOString(),
}

/**
 * Gender-filtered mock feed — mirrors the RLS rule in schema.sql:
 * 'boys_only' visible to males, 'girls_only' to females, 'any' to all.
 */
export function getMockFeed(gender?: 'male' | 'female' | null): FeedTravel[] {
  if (!gender) {
    // Unknown viewer gender: only show the rides marked 'any'.
    return MOCK_TRAVELS.filter((t) => t.gender_preference === 'any')
  }
  return MOCK_TRAVELS.filter((t) => {
    if (t.gender_preference === 'any') return true
    if (t.gender_preference === 'boys_only') return gender === 'male'
    return gender === 'female' // girls_only
  })
}

/**
 * Get a single travel by ID from mock data (for detail pages).
 */
export function getMockTravelById(id: string): FeedTravel | null {
  return MOCK_TRAVELS.find((t) => t.id === id) ?? null
}

/**
 * Get mock members for a travel (for detail pages).
 */
export function getMockMembers(travelId: string): Array<TravelMember & { profile: Profile | null }> {
  const travel = MOCK_TRAVELS.find((t) => t.id === travelId)
  if (!travel) return []

  const now = new Date().toISOString()
  const host = MOCK_PROFILES.find((p) => p.id === travel.host_id)
  const members: Array<TravelMember & { profile: Profile | null }> = [
    {
      id: `MEMBER_HOST_${travelId}`,
      travel_id: travelId,
      user_id: travel.host_id,
      is_host: true,
      is_full_route: true,
      km_from_origin: 0,
      joined_at: travel.created_at,
      profile: host ?? null,
    },
  ]

  // Add mock members based on travel
  if (travelId === 'TRAVEL_A') {
    const sara = MOCK_PROFILES.find((p) => p.id === 'USER_B_ID')
    const usman = MOCK_PROFILES.find((p) => p.id === 'USER_C_ID')
    members.push(
      {
        id: `MEMBER_B_${travelId}`,
        travel_id: travelId,
        user_id: 'USER_B_ID',
        is_host: false,
        is_full_route: false,
        km_from_origin: 280,
        joined_at: now,
        profile: sara ?? null,
      },
      {
        id: `MEMBER_C_${travelId}`,
        travel_id: travelId,
        user_id: 'USER_C_ID',
        is_host: false,
        is_full_route: true,
        km_from_origin: 0,
        joined_at: now,
        profile: usman ?? null,
      }
    )
  } else if (travelId === 'TRAVEL_B') {
    // No additional members yet
  } else if (travelId === 'TRAVEL_C') {
    // Could add members
  }

  return members
}

/**
 * Get mock waypoints for a travel.
 */
export function getMockWaypoints(travelId: string) {
  if (travelId === 'TRAVEL_A') {
    return [
      { id: 'WP_1', travel_id: 'TRAVEL_A', label: 'Islamabad Toll Plaza', lat: 33.6844, lng: 73.0479, km_from_origin: 280, sort_order: 0, created_at: new Date().toISOString() },
    ]
  }
  return []
}

/**
 * Get mock messages for a travel.
 */
export function getMockMessages(travelId: string): Array<Message & { sender?: Profile | null }> {
  const senderOf = (id: string): Profile | null =>
    MOCK_PROFILES.find((p) => p.id === id) ?? null

  if (travelId === 'TRAVEL_A') {
    return [
      {
        id: 'MSG_1',
        travel_id: 'TRAVEL_A',
        sender_id: null,
        content: 'Ali Hassan created this travel',
        is_system: true,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'MSG_2',
        travel_id: 'TRAVEL_A',
        sender_id: 'USER_B_ID',
        content: 'Hi! Can I join from Islamabad?',
        is_system: false,
        created_at: new Date(Date.now() - 1800000).toISOString(),
        sender: senderOf('USER_B_ID'),
      },
      {
        id: 'MSG_3',
        travel_id: 'TRAVEL_A',
        sender_id: 'USER_A_ID',
        content: 'Sure! I added Islamabad Toll Plaza as a pickup point.',
        is_system: false,
        created_at: new Date(Date.now() - 1200000).toISOString(),
        sender: senderOf('USER_A_ID'),
      },
      {
        id: 'MSG_4',
        travel_id: 'TRAVEL_A',
        sender_id: null,
        content: 'Sara Khan joined the travel',
        is_system: true,
        created_at: new Date(Date.now() - 600000).toISOString(),
      },
    ]
  }
  return []
}

/**
 * Get a mock bill slip (for the bill page demo fallback).
 */
export function getMockBillSlip(_travelId?: string): BillSlip | null {
  return MOCK_BILL_SLIP
}
