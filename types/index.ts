/**
 * CoolCarPool — Shared domain types.
 *
 * Every table alias here mirrors a table in `supabase/schema.sql` 1:1.
 * If you change the schema, change this file in the same commit.
 *
 * IMPORTANT: Tables are **type aliases**, not interfaces — supabase-js's
 * GenericSchema requires Row/Insert/Update to satisfy `Record<string, unknown>`
 * and interfaces don't get TypeScript's implicit index signature, which would
 * silently degrade the whole typed client to `never`.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Gender = 'male' | 'female'

export type GenderPreference = 'boys_only' | 'girls_only' | 'any'

export type PickupRadiusKm = 1 | 2 | 3

export type TravelStatus =
  | 'open'
  | 'locked'
  | 'cancelled'
  | 'in_progress'
  | 'completed'
  | 'settled'
  | 'merged'

export type TravelRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

export type DuplicateAction = 'kept' | 'merged' | 'pending'

/** Known notification variants (DB column is plain TEXT, so unknown values fall through). */
export const NOTIFICATION_TYPES = [
  'request_received',
  'request_accepted',
  'request_rejected',
  'member_joined',
  'member_left',
  'travel_locked',
  'travel_cancelled',
  'bill_uploaded',
  'bill_acknowledged',
  'duplicate_found',
  'travel_merged',
  'hostship_transferred',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number] | string

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export type Profile = {
  id: string
  full_name: string
  gender: Gender
  phone: string | null
  city: string | null
  avatar_url: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  vehicle_plate: string | null
  phone_verified: boolean
  email_verified: boolean
  created_at: string
}

export type Travel = {
  id: string
  host_id: string
  origin_text: string
  origin_lat: number | null
  origin_lng: number | null
  destination_text: string
  destination_lat: number | null
  destination_lng: number | null
  total_km: number
  departure_at: string
  is_recurring: boolean
  recurring_days: string[] | null
  total_seats: number
  available_seats: number
  gender_preference: GenderPreference
  pickup_radius_km: PickupRadiusKm
  estimated_cost_pkr: number | null
  description: string | null
  status: TravelStatus
  merged_into_id: string | null
  created_at: string
}

export type Waypoint = {
  id: string
  travel_id: string
  label: string
  lat: number | null
  lng: number | null
  km_from_origin: number
  sort_order: number
  created_at: string
}

export type TravelRequest = {
  id: string
  travel_id: string
  requester_id: string
  waypoint_id: string | null
  km_from_origin: number
  km_to_origin?: number | null
  status: TravelRequestStatus
  message: string | null
  seats_requested?: number
  created_at: string
}

export type TravelMember = {
  id: string
  travel_id: string
  user_id: string
  is_host: boolean
  is_full_route: boolean
  km_from_origin: number
  km_to_origin?: number | null
  seats_reserved?: number
  joined_at: string
}

export type Message = {
  id: string
  travel_id: string
  sender_id: string | null
  content: string
  is_system: boolean
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  type: string
  travel_id: string | null
  payload: NotificationPayload
  read: boolean
  created_at: string
}

export type NotificationPayload = Json

export type DuplicateMatch = {
  id: string
  primary_id: string
  candidate_id: string
  /** 0–1 raw composite score from the scoring matrix. */
  score: number
  origin_sim: number | null
  dest_sim: number | null
  date_match: boolean | null
  time_proximity: number | null
  gender_match: number | null
  action: DuplicateAction
  resolved_at: string | null
  created_at: string
}

/** Shape of the `breakdown` JSONB column produced by `lib/fare-engine.ts`. */
export type BillMemberFareRow = {
  userId: string
  fullName: string
  isHost: boolean
  isFullRoute: boolean
  kmCovered: number
  farePkr: number
  sharePercentage: number
}

export type BillSlipBreakdown = {
  per_km_rate_pkr?: number
  mid_route_total_pkr?: number
  remaining_bill_pkr?: number
  full_route_fare_head_pkr?: number
  members?: BillMemberFareRow[]
  total_allocated_pkr?: number
  rounding_pkr?: number
  ocr_source?: 'anthropic' | 'manual'
}

export type BillSlip = {
  id: string
  travel_id: string
  uploaded_by: string
  storage_path: string
  total_pkr: number | null
  total_km: number | null
  breakdown: BillSlipBreakdown
  acknowledged_by: string[]
  created_at: string
}

// ---------------------------------------------------------------------------
// Supabase Database generic (used by @supabase/ssr clients)
// ---------------------------------------------------------------------------

/** Row where every column is optional — used as the base for Insert/Update. */
type Writeable<Row extends object> = {
  [Key in keyof Row]?: Row[Key] | undefined
}

/**
 * FK metadata consumed by supabase-js's select-query-parser to validate
 * embedded resources (e.g. `host:profiles!travels_host_id_fkey(*)`).
 * Names must match the inline `REFERENCES` constraints in `supabase/schema.sql`
 * (PostgREST default naming: `<table>_<column>_<fkey>`).
 */
export type DatabaseRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type DatabaseTable<Row extends object, Relationships extends DatabaseRelationship[] = []> = {
  Row: Row
  Insert: Writeable<Row>
  Update: Writeable<Row>
  Relationships: Relationships
}

export type Database = {
  public: {
    Tables: {
      profiles: DatabaseTable<Profile>
      travels: DatabaseTable<
        Travel,
        [
          {
            foreignKeyName: 'travels_host_id_fkey'
            columns: ['host_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'travels_merged_into_id_fkey'
            columns: ['merged_into_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
        ]
      >
      waypoints: DatabaseTable<
        Waypoint,
        [
          {
            foreignKeyName: 'waypoints_travel_id_fkey'
            columns: ['travel_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
        ]
      >
      travel_requests: DatabaseTable<
        TravelRequest,
        [
          {
            foreignKeyName: 'travel_requests_travel_id_fkey'
            columns: ['travel_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'travel_requests_requester_id_fkey'
            columns: ['requester_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'travel_requests_waypoint_id_fkey'
            columns: ['waypoint_id']
            referencedRelation: 'waypoints'
            referencedColumns: ['id']
          },
        ]
      >
      travel_members: DatabaseTable<
        TravelMember,
        [
          {
            foreignKeyName: 'travel_members_travel_id_fkey'
            columns: ['travel_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'travel_members_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      >
      messages: DatabaseTable<
        Message,
        [
          {
            foreignKeyName: 'messages_travel_id_fkey'
            columns: ['travel_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      >
      notifications: DatabaseTable<
        Notification,
        [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_travel_id_fkey'
            columns: ['travel_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
        ]
      >
      duplicate_matches: DatabaseTable<
        DuplicateMatch,
        [
          {
            foreignKeyName: 'duplicate_matches_primary_id_fkey'
            columns: ['primary_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'duplicate_matches_candidate_id_fkey'
            columns: ['candidate_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
        ]
      >
      bill_slips: DatabaseTable<
        BillSlip,
        [
          {
            foreignKeyName: 'bill_slips_travel_id_fkey'
            columns: ['travel_id']
            referencedRelation: 'travels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bill_slips_uploaded_by_fkey'
            columns: ['uploaded_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      >
    }
    Views: Record<string, never>
    Functions: {
      /**
       * pg_trgm duplicate candidate matcher.
       * SQL definition lives in `supabase/duplicate-match.sql`.
       */
      match_duplicate_travels: {
        Args: {
          p_origin: string
          p_destination: string
          p_exclude_id: string | null
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row']
