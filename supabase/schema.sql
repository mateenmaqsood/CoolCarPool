-- CoolCarPool — full database schema
-- Source: "CoolCarPool — SCHEMA.md". Run in Supabase SQL Editor, top to bottom,
-- BEFORE any app traffic. duplicate-match.sql should be run right after this.

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  gender          TEXT NOT NULL CHECK (gender IN ('male','female')),
  phone           TEXT,
  city            TEXT,
  avatar_url      TEXT,
  vehicle_make    TEXT,
  vehicle_model   TEXT,
  vehicle_color   TEXT,
  vehicle_plate   TEXT,
  phone_verified  BOOLEAN DEFAULT FALSE,
  email_verified  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAVELS
-- ============================================================
CREATE TABLE travels (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  origin_text         TEXT NOT NULL,
  origin_lat          FLOAT,
  origin_lng          FLOAT,
  destination_text    TEXT NOT NULL,
  destination_lat     FLOAT,
  destination_lng     FLOAT,
  total_km            FLOAT NOT NULL DEFAULT 0,
  departure_at        TIMESTAMPTZ NOT NULL,
  is_recurring        BOOLEAN DEFAULT FALSE,
  recurring_days      TEXT[],
  total_seats         INT NOT NULL,
  available_seats     INT NOT NULL,
  gender_preference   TEXT NOT NULL CHECK (gender_preference IN ('boys_only','girls_only','any')),
  pickup_radius_km    INT NOT NULL DEFAULT 2 CHECK (pickup_radius_km IN (1,2,3)),
  estimated_cost_pkr  INT,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','locked','in_progress','completed','settled','merged','cancelled')),
  merged_into_id      UUID REFERENCES travels(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_travels_origin_trgm      ON travels USING GIN (origin_text gin_trgm_ops);
CREATE INDEX idx_travels_destination_trgm ON travels USING GIN (destination_text gin_trgm_ops);
CREATE INDEX idx_travels_status           ON travels (status);
CREATE INDEX idx_travels_departure_at     ON travels (departure_at);

-- ============================================================
-- WAYPOINTS
-- ============================================================
CREATE TABLE waypoints (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id        UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  lat              FLOAT,
  lng              FLOAT,
  km_from_origin   FLOAT NOT NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAVEL REQUESTS
-- ============================================================
CREATE TABLE travel_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id        UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  requester_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  waypoint_id      UUID REFERENCES waypoints(id),
  km_from_origin   FLOAT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','rejected','cancelled')),
  message          TEXT,
  seats_requested  INT NOT NULL DEFAULT 1 CHECK (seats_requested >= 1 AND seats_requested <= 4),
  km_to_origin     FLOAT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
  -- NOTE: no UNIQUE(travel_id, requester_id) — users may request again after
  -- a rejection and may reserve multiple seats (BUG 1).
);

-- ============================================================
-- TRAVEL MEMBERS (+ seat-sync trigger)
-- ============================================================
CREATE TABLE travel_members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id        UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_host          BOOLEAN DEFAULT FALSE,
  is_full_route    BOOLEAN DEFAULT TRUE,
  km_from_origin   FLOAT NOT NULL DEFAULT 0,
  km_to_origin     FLOAT,
  seats_reserved   INT NOT NULL DEFAULT 1 CHECK (seats_reserved >= 1 AND seats_reserved <= 4),
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(travel_id, user_id)
);

CREATE OR REPLACE FUNCTION sync_available_seats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE travels
  SET available_seats = total_seats - COALESCE((
    SELECT SUM(seats_reserved) FROM travel_members
    WHERE travel_id = COALESCE(NEW.travel_id, OLD.travel_id)
      AND is_host = FALSE
  ), 0)
  WHERE id = COALESCE(NEW.travel_id, OLD.travel_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_seats
AFTER INSERT OR DELETE ON travel_members
FOR EACH ROW EXECUTE FUNCTION sync_available_seats();

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id   UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES profiles(id),
  content     TEXT NOT NULL,
  is_system   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_travel ON messages(travel_id, created_at);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  travel_id   UUID REFERENCES travels(id),
  payload     JSONB DEFAULT '{}',
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ============================================================
-- DUPLICATE MATCHES
-- ============================================================
CREATE TABLE duplicate_matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_id      UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  score           FLOAT NOT NULL,
  origin_sim      FLOAT,
  dest_sim        FLOAT,
  date_match      BOOLEAN,
  time_proximity  FLOAT,
  gender_match    FLOAT,
  action          TEXT CHECK (action IN ('kept','merged','pending')) DEFAULT 'pending',
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BILL SLIPS
-- ============================================================
CREATE TABLE bill_slips (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id       UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES profiles(id),
  storage_path    TEXT NOT NULL,
  total_pkr       INT,
  total_km        FLOAT,
  breakdown       JSONB DEFAULT '{}',
  acknowledged_by UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE travels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE waypoints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_slips        ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- TRAVELS (gender-filtered)
CREATE POLICY "travels_select_gender" ON travels FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    gender_preference = 'any'
    OR (gender_preference = 'boys_only'  AND (SELECT gender FROM profiles WHERE id = auth.uid()) = 'male')
    OR (gender_preference = 'girls_only' AND (SELECT gender FROM profiles WHERE id = auth.uid()) = 'female')
    OR host_id = auth.uid()
  )
);
CREATE POLICY "travels_insert_own"   ON travels FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "travels_update_host"  ON travels FOR UPDATE USING (auth.uid() = host_id);

-- WAYPOINTS
CREATE POLICY "waypoints_select" ON waypoints FOR SELECT USING (
  EXISTS (SELECT 1 FROM travel_members WHERE travel_id = waypoints.travel_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM travels WHERE id = waypoints.travel_id AND host_id = auth.uid())
  OR EXISTS (SELECT 1 FROM travels WHERE id = waypoints.travel_id AND status = 'open')
);
CREATE POLICY "waypoints_insert_host" ON waypoints FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM travels WHERE id = travel_id AND host_id = auth.uid())
);
CREATE POLICY "waypoints_update_host" ON waypoints FOR UPDATE USING (
  EXISTS (SELECT 1 FROM travels WHERE id = travel_id AND host_id = auth.uid())
);

-- TRAVEL REQUESTS
CREATE POLICY "requests_select" ON travel_requests FOR SELECT USING (
  requester_id = auth.uid()
  OR EXISTS (SELECT 1 FROM travels WHERE id = travel_id AND host_id = auth.uid())
);
CREATE POLICY "requests_insert_own" ON travel_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "requests_update" ON travel_requests FOR UPDATE USING (
  auth.uid() = requester_id
  OR EXISTS (SELECT 1 FROM travels WHERE id = travel_id AND host_id = auth.uid())
);

-- TRAVEL MEMBERS
-- NOTE: never query travel_members inside its own policy (infinite recursion).
-- Use the host relationship on travels instead.
CREATE POLICY "members_select" ON travel_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM travels WHERE id = travel_members.travel_id AND host_id = auth.uid())
);
CREATE POLICY "members_insert_host" ON travel_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM travels WHERE id = travel_id AND host_id = auth.uid())
  OR auth.uid() = user_id
);

-- MESSAGES (members only)
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM travel_members WHERE travel_id = messages.travel_id AND user_id = auth.uid())
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM travel_members WHERE travel_id = messages.travel_id AND user_id = auth.uid())
);

-- NOTIFICATIONS — split policies: everyone reads/edits their own, but any
-- authenticated user may INSERT a notification targeting someone else
-- (e.g. a passenger notifying the host of a seat request).
CREATE POLICY "notifs_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifs_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifs_delete_own" ON notifications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "notifs_insert_auth" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- BILL SLIPS (members select, host insert/update)
CREATE POLICY "slips_select" ON bill_slips FOR SELECT USING (
  EXISTS (SELECT 1 FROM travel_members WHERE travel_id = bill_slips.travel_id AND user_id = auth.uid())
);
CREATE POLICY "slips_insert_host" ON bill_slips FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM travels WHERE id = travel_id AND host_id = auth.uid())
);
CREATE POLICY "slips_update_host" ON bill_slips FOR UPDATE USING (
  EXISTS (SELECT 1 FROM travels WHERE id = travel_id AND host_id = auth.uid())
);

-- DUPLICATE MATCHES (host of primary travel)
CREATE POLICY "dupes_select_host" ON duplicate_matches FOR SELECT USING (
  EXISTS (SELECT 1 FROM travels WHERE id = primary_id AND host_id = auth.uid())
);
CREATE POLICY "dupes_update_host" ON duplicate_matches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM travels WHERE id = primary_id AND host_id = auth.uid())
);

-- ============================================================
-- SEED DATA (post-setup)
-- Replace USER_A_ID / USER_B_ID / USER_C_ID with real UUIDs from auth.users
-- and TRAVEL_A/B/C ids with the generated travel IDs.
-- ============================================================
-- INSERT INTO profiles (id, full_name, gender, phone, city) VALUES
--   ('USER_A_ID', 'Ali Hassan',  'male',   '+923001234567', 'Lahore'),
--   ('USER_B_ID', 'Sara Khan',   'female', '+923007654321', 'Islamabad'),
--   ('USER_C_ID', 'Usman Tariq', 'male',   '+923009876543', 'Lahore');
--
-- INSERT INTO travels (id, host_id, origin_text, destination_text, total_km, departure_at,
--   total_seats, available_seats, gender_preference, pickup_radius_km, estimated_cost_pkr, status)
-- VALUES ('TRAVEL_A', 'USER_A_ID', 'Lahore', 'Murree', 310,
--   NOW() + INTERVAL '2 days', 4, 3, 'boys_only', 2, 2500, 'open');
--
-- INSERT INTO waypoints (travel_id, label, km_from_origin, sort_order)
-- VALUES ('TRAVEL_A', 'Islamabad Toll Plaza', 280, 1);
--
-- INSERT INTO travels (id, host_id, origin_text, destination_text, total_km, departure_at,
--   total_seats, available_seats, gender_preference, pickup_radius_km, estimated_cost_pkr, status)
-- VALUES ('TRAVEL_B', 'USER_C_ID', 'Lahore', 'Murree', 310,
--   NOW() + INTERVAL '2 days 55 minutes', 4, 4, 'boys_only', 1, 2800, 'open');
--
-- INSERT INTO travels (id, host_id, origin_text, destination_text, total_km, departure_at,
--   total_seats, available_seats, gender_preference, pickup_radius_km, estimated_cost_pkr, status)
-- VALUES ('TRAVEL_C', 'USER_B_ID', 'Islamabad', 'Murree', 60,
--   NOW() + INTERVAL '1 day', 3, 2, 'girls_only', 2, 800, 'open');
--
-- INSERT INTO travel_members (travel_id, user_id, is_host, is_full_route, km_from_origin) VALUES
--   ('TRAVEL_A', 'USER_A_ID', TRUE, TRUE, 0),
--   ('TRAVEL_B', 'USER_C_ID', TRUE, TRUE, 0),
--   ('TRAVEL_C', 'USER_B_ID', TRUE, TRUE, 0);

-- ============================================================
-- AUTH TRIGGER — auto-create profile on signup (idempotent)
-- Uses the REAL profiles columns (phone, city — NOT phone_number).
-- Run in Supabase SQL Editor. Safe to re-run (CREATE OR REPLACE).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, gender, city, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'gender', 'male'),
    NULLIF(new.raw_user_meta_data->>'city', ''),
    NULLIF(new.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        gender    = EXCLUDED.gender,
        city      = EXCLUDED.city,
        phone     = EXCLUDED.phone;
  RETURN new;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HOTFIX BATCH — run in Supabase SQL Editor (idempotent)
-- 1. members_select: was self-referencing travel_members (infinite
--    recursion crashing chat) → now joins via travels.host_id.
-- 2. Backfill profiles for any auth user the trigger missed
--    (fixes travel_requests FK violations "Could not send request").
-- 3. Avatar UPDATE policy (re-upload over existing file).
-- ============================================================

-- 1. travel_members select without recursion
DROP POLICY IF EXISTS "members_select" ON travel_members;
CREATE POLICY "members_select" ON travel_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM travels WHERE id = travel_members.travel_id AND host_id = auth.uid())
);

-- 2. Ensure every auth user has a profile row (backfill, safe to re-run)
INSERT INTO public.profiles (id, full_name, gender)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', 'User'),
       COALESCE(u.raw_user_meta_data->>'gender', 'male')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 3. Storage — public read + own-folder upload AND update
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_user_upload" ON storage.objects;
CREATE POLICY "avatars_user_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- HOTFIX BATCH 2 — multi-seat booking + avatar bucket hardening
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1. travel_requests: allow re-request + multiple seats (BUG 1)
ALTER TABLE travel_requests DROP CONSTRAINT IF EXISTS travel_requests_travel_id_requester_id_key;
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS seats_requested INT NOT NULL DEFAULT 1
  CHECK (seats_requested >= 1 AND seats_requested <= 4);

-- 2. travel_members: seats_reserved per row (multiple seats, one row per user)
ALTER TABLE travel_members ADD COLUMN IF NOT EXISTS seats_reserved INT NOT NULL DEFAULT 1
  CHECK (seats_reserved >= 1 AND seats_reserved <= 4);

-- 3. Seat-sync trigger: count RESERVED SEATS, not member rows
CREATE OR REPLACE FUNCTION public.sync_available_seats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.travels
  SET available_seats = total_seats - COALESCE((
    SELECT SUM(seats_reserved) FROM public.travel_members
    WHERE travel_id = COALESCE(NEW.travel_id, OLD.travel_id)
      AND is_host = FALSE
  ), 0)
  WHERE id = COALESCE(NEW.travel_id, OLD.travel_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_seats ON travel_members;
CREATE TRIGGER trg_sync_seats
  AFTER INSERT OR DELETE ON travel_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_available_seats();

-- Recount existing travels (one-time repair after adding seats_reserved)
UPDATE public.travels t
SET available_seats = t.total_seats - COALESCE((
  SELECT SUM(seats_reserved) FROM public.travel_members m
  WHERE m.travel_id = t.id AND m.is_host = FALSE
), 0);

-- 4. Avatars bucket (create if missing) + full policy set incl. delete
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- HOTFIX BATCH 3 — sub-portion rides (both endpoints mid-route)
-- km_to_origin NULL = rides to the destination (backward compatible).
-- ============================================================
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS km_to_origin FLOAT;
ALTER TABLE travel_members  ADD COLUMN IF NOT EXISTS km_to_origin FLOAT;

-- Allow cancelling travels (host action from the Profile page)
ALTER TABLE travels DROP CONSTRAINT IF EXISTS travels_status_check;
ALTER TABLE travels ADD CONSTRAINT travels_status_check
  CHECK (status IN ('open','locked','in_progress','completed','settled','merged','cancelled'));

-- ============================================================
-- NOTIFICATIONS — split policies (passenger notifies the host)
-- ============================================================
DROP POLICY IF EXISTS "notifs_own" ON notifications;
CREATE POLICY "notifs_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifs_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifs_delete_own" ON notifications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "notifs_insert_auth" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
