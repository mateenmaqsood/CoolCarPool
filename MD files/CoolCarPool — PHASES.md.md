# CoolCarPool — PHASES.md

## Pre-Build Setup (Before the Clock Starts)

## Phase 1 — Auth & Profile (Hour 1)

## Phase 2 — Host Form & Ride Feed (Hour 2–3)

## Phase 3 — Route, Waypoints & Chat (Hour 3–4)

## Phase 4 — Cost Split & AI Slip (Hour 4–5)

## Phase 5 — Duplicate Detector (Hour 5–6)

## Phase 6 — Polish & Deploy (Final 30 min)

## Cut Priority if Time Runs Out

## Pre-Build Setup (Before the Clock Starts)

Do all of this before you start the 5-hour timer.

- [ ] Create Supabase project → copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` and `SERVICE_ROLE_KEY`
- [ ] Run `Extensions` SQL block from SCHEMA.md
- [ ] Run the full `schema.sql` in Supabase SQL Editor
- [ ] Run `rls.sql` (all RLS policies)
- [ ] Enable Realtime on: `travels`, `messages`, `notifications`, `travel_members`, `travel_requests`
- [ ] Create Storage bucket `bill-slips`: private, 10 MB, images only
- [ ] Create Vercel project → link GitHub repo → add all env vars
- [ ] `npx create-next-app@latest coolcarpool --typescript --tailwind --app --src-dir`
- [ ] `npm i @supabase/supabase-js @supabase/ssr react-hook-form zod @hookform/resolvers`
- [ ] `npm i class-variance-authority clsx tailwind-merge lucide-react`
- [ ] Copy `.env.local.example` → `.env.local` and fill keys
- [ ] Push to GitHub → verify Vercel auto-deploys

## Phase 1 — Auth & Profile (Hour 1)

**Goal:** Any user can sign up with gender, log in, and edit their profile. Protected routes redirect unauthenticated users.

### GLM Task 1 (use GLM 5.3 Flash here)

Ask GLM to write:

1. `lib/supabase/client.ts` — browser Supabase client
2. `lib/supabase/server.ts` — server Supabase client (cookies)
3. `middleware.ts` — protect `/feed`, `/host`, `/travel/**`, `/profile/**`

### Nemotron Tasks (Phase 1)

- `app/(auth)/signup/page.tsx` — fields: full name, email, password, gender (required radio), city, phone
  - On submit: `supabase.auth.signUp` then `INSERT INTO profiles`
- `app/(auth)/login/page.tsx` — email + password → redirect to `/feed`
- `app/(app)/profile/edit/page.tsx` — vehicle make/model/color/plate, avatar upload to `avatars` bucket
- `components/ui/` — Button, Input, Card, Badge, Avatar, Skeleton, Toast (Apple design tokens)

### Done When:

- [ ] Signup creates row in `auth.users` AND `profiles`
- [ ] Login works, redirects to `/feed`
- [ ] `/feed` redirects to `/login` if no session
- [ ] Profile edit saves vehicle info
- [ ] Gender stored correctly, visible in profile

## Phase 2 — Host Form & Ride Feed (Hour 2–3)

**Goal:** Host can post a travel. Any logged-in user sees a gender-filtered feed. Duplicate Detector runs on submit.

### Nemotron Tasks (Phase 2)

- `app/(app)/host/page.tsx` — 4-step multi-step form:
  - Step 1: Origin text, Destination text (free text with city autocomplete from hardcoded list)
  - Step 2: Departure date + time, is\_recurring toggle + days checkboxes
  - Step 3: Total seats (1–8), gender preference (radio: boys/girls/any), pickup radius (1/2/3 km), estimated cost PKR
  - Step 4: Description (optional), vehicle info display, review summary before submit
- `app/(app)/feed/page.tsx` — RSC, gender-filtered query, search bar (partial text match on origin OR destination), date/price/seats filters
- `components/travel/TravelCard.tsx` — shows origin → destination, departure time, seats left badge, gender badge, estimated cost, host avatar
- `components/travel/DuplicateModal.tsx` — similarity bar, reason pills (same route / same date / time proximity / gender match), Merge / Keep CTA
- `lib/mock-data.ts` — 3 mock travels for feed fallback

### GLM Task 2 (use GLM 5.3 Flash here)

`app/api/duplicate-check/route.ts` — POST handler:

1. Receives `{ origin, destination, departure_at, gender_preference, exclude_id }`
2. Runs pg\_trgm similarity query on `travels` table
3. Scores each candidate: `(originSim × 0.30) + (destSim × 0.30) + (dateMatch × 0.20) + (timeProx × 0.15) + (genderMatch × 0.05)` × 100
4. Returns `{ matches: [{ id, score, reasons[], travel }] }` sorted by score desc
5. Only returns matches with score > 40

### Done When:

- [ ] Host can submit a 4-step form → travel appears in `travels` table
- [ ] Feed shows only gender-appropriate rides
- [ ] Search filters work (origin/destination text)
- [ ] Posting a near-duplicate triggers `DuplicateModal` at > 60% score
- [ ] Feed has mock data fallback if Supabase fails

## Phase 3 — Route, Waypoints & Chat (Hour 3–4)

**Goal:** Hosts add waypoints. Mid-route riders can request to join from a waypoint. Group chat works.

### Nemotron Tasks (Phase 3)

- `app/(app)/travel/[id]/page.tsx` — Travel detail:
  - `SVGRouteMap` with origin → waypoints → destination animated line
  - Seat map grid (filled / available / mid-route badges)
  - Join request modal (full route or select waypoint)
  - Host approval panel: pending requests list with Accept / Reject
  - Lock Travel button (host only)
  - Transfer Hostship modal
- `components/route/SVGRouteMap.tsx` — SVG with:
  - Dots for each city stop (origin, waypoints, destination)
  - Animated stroke-dashoffset line draw
  - Radius circles around waypoints (1/2/3 km)
  - Toggle to Google Maps embed if `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is set
- `components/route/WaypointPicker.tsx` — host adds stops with label + km
- `app/(app)/travel/[id]/chat/page.tsx` — group chat:
  - Supabase Realtime subscription on `messages`
  - System messages: "Ali Hassan joined", "Travel locked"
  - Phone number shown in member list ONLY after user is accepted

### Done When:

- [ ] SVG route renders with waypoints
- [ ] Mid-route rider can request from ISB waypoint
- [ ] Host can Accept / Reject requests
- [ ] Accepted rider appears in member list with km badge
- [ ] Chat sends and receives in realtime
- [ ] Lock button changes travel status to `locked`; nobody can leave after

## Phase 4 — Cost Split & AI Slip (Hour 4–5)

**Goal:** Host uploads receipt photo. AI extracts PKR total. App calculates itemized bill per member.

### GLM Task 3 (use GLM 5.3 Flash here)

`lib/fare-engine.ts` — pure function:

```
input: { total_pkr, total_km, members: [{ id, is_full_route, km_from_origin }] }

Step 1: per_km_rate = total_pkr / total_km
Step 2: for each mid-route member: mid_cost = (total_km - km_from_origin) * per_km_rate
Step 3: mid_total = sum of all mid_costs
Step 4: remaining = total_pkr - mid_total
Step 5: full_route_count = count(full-route members) + 1 (host)
Step 6: full_route_cost = remaining / full_route_count

output: { per_km_rate, breakdown: [{ member_id, amount, km_covered, type }] }
```

### Nemotron Tasks (Phase 4)

- `app/(app)/travel/[id]/bill/page.tsx`
- `components/cost/SlipUploader.tsx` — drag-drop image upload → Supabase Storage → calls `/api/detect-slip`
- `app/api/detect-slip/route.ts` — sends image to `claude-sonnet-4-6`, prompt: "Extract the total PKR amount from this receipt. Return JSON: `{total_pkr: number}`. If unclear, return `{total_pkr: null}`."
- Fallback: if OCR fails or returns null → show manual input field (never crashes)
- `components/cost/CostBreakdown.tsx` — receipt card visible to ALL travel members:
  - Per-member row: name, km covered, amount owed in PKR
  - "Pay" acknowledgement button per member
  - Export as downloadable image (html2canvas)

### Done When:

- [ ] Host uploads photo → AI extracts amount (or manual fallback shows)
- [ ] Fare engine calculates correct split (test with ISB waypoint example)
- [ ] All members see the receipt card
- [ ] Each member can tap "Acknowledged" on their row

## Phase 5 — Duplicate Detector (Hour 5–6)

**Goal:** Card 3 from TechSOC fully demoed — a host posting a near-duplicate ride sees the modal.

- [ ] Verify `/api/duplicate-check` works with the seed data (`TRAVEL_A` and `TRAVEL_B` should score \~87%)
- [ ] `DuplicateModal` shows: similarity progress bar, reason pills, matched travel preview card
- [ ] **Keep** → posts as new travel, records action = 'kept' in `duplicate_matches`
- [ ] **Merge** → primary travel gets merged, secondary set to `status = 'merged'`, pending requests transferred, all members notified via `notifications`
- [ ] 40–60% score → subtle banner "Similar rides exist" (no modal)
- [ ] < 40% → posts silently

## Phase 6 — Polish & Deploy (Final 30 min)

- [ ] `app/(app)/legal/tos/page.tsx` — full boilerplate Terms of Service (use Nemotron to generate)
- [ ] `app/(app)/legal/privacy/page.tsx` — Privacy Policy
- [ ] Dark mode QA: test every page in `[data-theme="dark"]`
- [ ] Mobile QA: check feed, host form, travel detail on 390px viewport
- [ ] `supabase/seed.sql` — verify seed data loads correctly for demo
- [ ] Resend email: request received, accepted, locked, bill submitted (or in-app only if Resend key missing)
- [ ] Vercel env vars: add all keys, redeploy
- [ ] End-to-end demo walkthrough: sign up → host travel → trigger duplicate modal → another account joins → chat → upload slip → see bill

## Cut Priority if Time Runs Out

Do these in order — each is a complete, demo-able app even if you stop here:

1. ✅ **Must have** — Auth, Profile, Feed, Host form, Gender filter, TravelCard
2. ✅ **Must have** — Duplicate Detector (required by TechSOC Card 3)
3. ✅ **Must have** — Join request + Host approval + Travel detail page
4. 🟡 **Should have** — SVG Route map + Waypoint picker
5. 🟡 **Should have** — Group chat (Realtime)
6. 🟡 **Should have** — Cost split + AI slip OCR
7. 🔵 **Nice to have** — Realtime feed updates
8. 🔵 **Nice to have** — Export receipt as image
9. ⚪ **Cut if needed** — Recurring rides
10. ⚪ **Cut if needed** — Rating/block system
11. ⚪ **Cut if needed** — Legal pages (can be blank stubs)
