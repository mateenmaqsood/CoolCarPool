-- CoolCarPool — pg_trgm duplicate candidate matcher
-- Run AFTER schema.sql (needs the travels table). Requires the pg_trgm extension.
--
-- Finds OPEN travels that look similar to a travel being posted, returning each
-- candidate as a JSON object with per-field trigram similarity scores.
--
-- Behavior:
--   * Only rows with status = 'open' are considered.
--   * The travel being posted is excluded via p_exclude_id.
--   * A row qualifies when origin OR destination trigram similarity > 0.25.
--   * Runs as INVOKER, so all travels-table RLS (incl. the gender filter)
--     still applies to the calling role.
--
-- Example:
--   SELECT match_duplicate_travels('Lahore', 'Murree', 'TRAVEL_B_UUID');

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP FUNCTION IF EXISTS match_duplicate_travels(TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION match_duplicate_travels(
  p_origin      TEXT,
  p_destination TEXT,
  p_exclude_id  UUID
)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT jsonb_build_object(
    'matches',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',                  t.id,
          'host_id',             t.host_id,
          'origin_text',         t.origin_text,
          'origin_lat',          t.origin_lat,
          'origin_lng',          t.origin_lng,
          'destination_text',    t.destination_text,
          'destination_lat',     t.destination_lat,
          'destination_lng',     t.destination_lng,
          'total_km',            t.total_km,
          'departure_at',        t.departure_at,
          'is_recurring',        t.is_recurring,
          'recurring_days',      t.recurring_days,
          'total_seats',         t.total_seats,
          'available_seats',     t.available_seats,
          'gender_preference',   t.gender_preference,
          'pickup_radius_km',    t.pickup_radius_km,
          'estimated_cost_pkr',  t.estimated_cost_pkr,
          'description',         t.description,
          'status',              t.status,
          'merged_into_id',      t.merged_into_id,
          'created_at',          t.created_at,
          'origin_sim',          similarity(t.origin_text,      COALESCE(p_origin, '')),
          'dest_sim',            similarity(t.destination_text, COALESCE(p_destination, ''))
        ) ORDER BY
          GREATEST(similarity(t.origin_text, COALESCE(p_origin, '')),
                   similarity(t.destination_text, COALESCE(p_destination, ''))) DESC
      ),
      '[]'::jsonb
    )
  )
  FROM travels t
  WHERE t.status = 'open'
    AND (p_exclude_id IS NULL OR t.id <> p_exclude_id)
    AND (
      similarity(t.origin_text,      COALESCE(p_origin, ''))      > 0.25
      OR
      similarity(t.destination_text, COALESCE(p_destination, '')) > 0.25
    );
$$;
