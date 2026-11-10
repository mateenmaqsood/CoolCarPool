# CoolCarPool — SCHEMA.md

## Extensions

## Profiles Table

## Travels Table

## Waypoints Table

## Travel Requests Table

## Travel Members Table

## Messages Table

## Notifications Table

## Duplicate Matches Table

## Bill Slips Table

## DB Triggers & Functions

## Row Level Security Policies

## Seed Data

## Extensions

Run these once in the Supabase SQL Editor before anything else.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Profiles Table

```sql
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
```

## Travels Table

```sql
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
                        CHECK (status IN ('open','locked','in_progress','completed','settled','merged')),
  merged_into_id      UUID REFERENCES travels(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_travels_origin_trgm      ON travels USING GIN (origin_text gin_trgm_ops);
CREATE INDEX idx_travels_destination_trgm ON travels USING GIN (destination_text gin_trgm_ops);
CREATE INDEX idx_travels_status           ON travels (status);
CREATE INDEX idx_travels_departure_at     ON travels (departure_at);
```

## Waypoints Table

```sql
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
```

## Travel Requests Table

```sql
CREATE TABLE travel_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id        UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  requester_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  waypoint_id      UUID REFERENCES waypoints(id),
  km_from_origin   FLOAT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','rejected','cancelled')),
  message          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(travel_id, requester_id)
);
```

## Travel Members Table

```sql
CREATE TABLE travel_members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id        UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_host          BOOLEAN DEFAULT FALSE,
  is_full_route    BOOLEAN DEFAULT TRUE,
  km_from_origin   FLOAT NOT NULL DEFAULT 0,
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(travel_id, user_id)
);

CREATE OR REPLACE FUNCTION sync_available_seats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE travels
  SET available_seats = total_seats - (
    SELECT COUNT(*) FROM travel_members
    WHERE travel_id = COALESCE(NEW.travel_id, OLD.travel_id)
      AND is_host = FALSE
  )
  WHERE id = COALESCE(NEW.travel_id, OLD.travel_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_seats
AFTER INSERT OR DELETE ON travel_members
FOR EACH ROW EXECUTE FUNCTION sync_available_seats();
```

## Messages Table

```sql
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_id   UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES profiles(id),
  content     TEXT NOT NULL,
  is_system   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_travel ON messages(travel_id, created_at);
```

## Notifications Table

```sql
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
```

## Duplicate Matches Table

```sql
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
```

## Bill Slips Table

```sql
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
```

## Row Level Security Policies

```sql
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
CREATE POLICY "members_select" ON travel_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM travel_members tm2 WHERE tm2.travel_id = travel_members.travel_id AND tm2.user_id = auth.uid())
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

-- NOTIFICATIONS (own only)
CREATE POLICY "notifs_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- BILL SLIPS (members only, host inserts)
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
```

## Supabase Realtime — Enable These

Dashboard → Database → Replication → enable Realtime on: `travels`, `messages`, `notifications`, `travel_members`, `travel_requests`

Storage bucket: `bill-slips` — set to **private**, 10 MB max, images only.

## Seed Data

Replace `USER_A_ID`, `USER_B_ID`, `USER_C_ID` with real UUIDs from `auth.users` after creating test accounts.

```sql
INSERT INTO profiles (id, full_name, gender, phone, city) VALUES
  ('USER_A_ID', 'Ali Hassan',  'male',   '+923001234567', 'Lahore'),
  ('USER_B_ID', 'Sara Khan',   'female', '+923007654321', 'Islamabad'),
  ('USER_C_ID', 'Usman Tariq', 'male',   '+923009876543', 'Lahore');

-- Travel 1: Lahore to Murree, boys only
INSERT INTO travels (id, host_id, origin_text, destination_text, total_km, departure_at,
  total_seats, available_seats, gender_preference, pickup_radius_km, estimated_cost_pkr, status)
VALUES ('TRAVEL_A', 'USER_A_ID', 'Lahore', 'Murree', 310,
  NOW() + INTERVAL '2 days', 4, 3, 'boys_only', 2, 2500, 'open');

INSERT INTO waypoints (travel_id, label, km_from_origin, sort_order)
VALUES ('TRAVEL_A', 'Islamabad Toll Plaza', 280, 1);

-- Travel 2: Near-duplicate for Duplicate Detector demo (55 min apart, same route)
INSERT INTO travels (id, host_id, origin_text, destination_text, total_km, departure_at,
  total_seats, available_seats, gender_preference, pickup_radius_km, estimated_cost_pkr, status)
VALUES ('TRAVEL_B', 'USER_C_ID', 'Lahore', 'Murree', 310,
  NOW() + INTERVAL '2 days 55 minutes', 4, 4, 'boys_only', 1, 2800, 'open');

-- Travel 3: Girls only, ISB to Murree
INSERT INTO travels (id, host_id, origin_text, destination_text, total_km, departure_at,
  total_seats, available_seats, gender_preference, pickup_radius_km, estimated_cost_pkr, status)
VALUES ('TRAVEL_C', 'USER_B_ID', 'Islamabad', 'Murree', 60,
  NOW() + INTERVAL '1 day', 3, 2, 'girls_only', 2, 800, 'open');

INSERT INTO travel_members (travel_id, user_id, is_host, is_full_route, km_from_origin) VALUES
  ('TRAVEL_A', 'USER_A_ID', TRUE, TRUE, 0),
  ('TRAVEL_B', 'USER_C_ID', TRUE, TRUE, 0),
  ('TRAVEL_C', 'USER_B_ID', TRUE, TRUE, 0);
```
