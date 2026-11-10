# CoolCarPool — CLAUDE.md

*Hackathon Project Bible | Next.js 14 + Supabase + Tailwind CSS + Vercel*

---

## 🎯 Mystery Feature Decoded — DUPLICATE DETECTOR (TechSOC Card 3)

Your mystery card is **Card 3: Duplicate Detector**. Here is exactly how it integrates into CoolCarPool:

**What it does:** When a host submits a new travel, the system scans existing open travels and shows a similarity score with an explanation. Host chooses **Keep** (post separately) or **Merge** (combine into one ride with shared traveler pool).

**Example output:** *"Match 87% — Same route, same date, 1 hour apart"*

**Where it triggers:** Host submits travel form → `POST /api/travels` → auto-calls `/api/duplicate-check` → if any match > 60% → show `<DuplicateModal>` before confirming

**Scoring algorithm:**

```
origin_text similarity      × 0.30  (via pg_trgm)
destination_text similarity × 0.30
same calendar date          × 0.20
time proximity:
  ≤ 1h → 1.0, ≤ 2h → 0.7, ≤ 6h → 0.3, else → 0  × 0.15
gender_preference match:
  exact → 1.0, one is 'any' → 0.5, else → 0        × 0.05
```

**Thresholds:** `< 40%` → silent post | `40–60%` → subtle banner | `> 60%` → full DuplicateModal

**Merge behavior:** Primary travel keeps its settings; secondary set to `status='merged'`; pending requests transferred; all users notified.

---

## 📦 Project Overview

| Field | Value |
| --- | --- |
| **App Name** | CoolCarPool |
| **Stack** | Next.js 14 App Router + Supabase + Tailwind CSS v3 + Vercel |
| **Demo URL** | `coolcarpool.vercel.app` |
| **Build window** | 5–7 hours to working end-to-end demo |
| **AI — Slip OCR** | Anthropic `claude-sonnet-4-6` |
| **AI — Duplicates** | Postgres `pg_trgm` + JS scoring (no external API, no rate limits) |

---

## 🛠 Tech Stack

| Layer | Technology | Why |
| --- | --- | --- |
| Framework | Next.js 14 App Router | RSC-first, SEO, edge-ready |
| Database | Supabase Postgres | Realtime, Auth, Storage in one |
| Auth | Supabase Auth (Email+Pass) | Simple, proven |
| Styling | Tailwind CSS v3 | Fast iteration |
| Forms | react-hook-form + Zod | Type-safe validation |
| Realtime | Supabase Realtime channels | Live feed + group chat |
| Storage | Supabase Storage | Bill slip images |
| AI — Slip OCR | Anthropic `claude-sonnet-4-6` | Extract PKR total from receipt photo |
| AI — Duplicates | Postgres `pg_trgm` + JS scoring | No API rate limits |
| Email | Resend | Ride event notifications |
| Maps | SVG simulation (default) + Google Maps optional | Zero API risk for demo |
| Deploy | Vercel | Auto-deploy from Git |

---

## 📖 Terminology

| Term | Definition |
| --- | --- |
| **Host** | Person who creates a travel (never the app admin) |
| **Traveler** | Anyone who joins a hosted travel |
| **Travel** | A ride posting (e.g. Lahore → Murree at 3pm Saturday) |
| **Waypoint** | A mid-route pickup point the host adds |
| **Full-route traveler** | Rides from origin all the way to destination |
| **Mid-route traveler** | Joins from a waypoint, pays proportionally less |

---

## 🧠 Core Domain Logic

### 1 — Gender Security

```
profile.gender           : 'male' | 'female'
travel.gender_preference : 'boys_only' | 'girls_only' | 'any'

Filtering rule (enforced at app layer AND Supabase RLS):
  'boys_only'  → only visible to male users
  'girls_only' → only visible to female users
  'any'        → visible to all authenticated users
```

### 2 — Travel Lifecycle

```
open → locked → in_progress → completed → settled

RULES:
  • Host CANNOT cancel after any traveler is accepted
  • Host CAN transfer hostship to another member, then leave
  • After lock: nobody can leave the travel (RLS + app enforced)
  • available_seats auto-synced by DB trigger on travel_members
  • When available_seats = 0: travel disappears from active feed
```

### 3 — KM Cost Split Formula

```
GIVEN:
  total_bill   = PKR total extracted from slip by AI
  total_km     = full route km
  travelers    = [{ id, is_full_route, join_km }]
  host         = always pays full route cost

STEP 1: per_km_rate     = total_bill / total_km
STEP 2: mid_cost[i]     = (total_km − join_km[i]) × per_km_rate
        (for each mid-route traveler)
STEP 3: mid_total       = Σ mid_cost[i]
STEP 4: remaining_bill  = total_bill − mid_total
STEP 5: full_route_pax  = count(full-route travelers) + 1  (host counts as 1)
STEP 6: full_route_cost = remaining_bill / full_route_pax

OUTPUT: Itemized receipt card visible to ALL members of the travel.
```

### 4 — Duplicate Detector (Mystery Feature)

```
TRIGGER: After host submits travel form
INPUT:   origin_text, destination_text, departure_at, gender_preference

STEP 1: SQL with pg_trgm:
  SELECT *, similarity(origin_text, $1) as orig_sim,
           similarity(destination_text, $2) as dest_sim
  FROM travels
  WHERE (similarity(origin_text,$1) > 0.25
      OR similarity(destination_text,$2) > 0.25)
    AND status = 'open' AND id != $excludeId

STEP 2: Score each candidate:
  score = (originSim × 0.30) + (destSim × 0.30)
        + (dateMatch × 0.20) + (timeProx × 0.15)
        + (genderMatch × 0.05)
  → multiply by 100 → percentage (0–100)

STEP 3:
  score < 40%  → post silently
  40–60%       → show banner "Similar rides exist"
  > 60%        → show DuplicateModal (Card 3 requirement)
```

---

## 🗂 File Structure

```
coolcarpool/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                  ← App shell: nav + dark mode toggle
│   │   ├── feed/page.tsx               ← Find rides (RSC + gender filter)
│   │   ├── host/page.tsx               ← Create travel (multi-step form)
│   │   ├── travel/[id]/
│   │   │   ├── page.tsx                ← Ride detail + join request
│   │   │   ├── chat/page.tsx           ← Group chat (Supabase Realtime)
│   │   │   └── bill/page.tsx           ← Upload slip + cost breakdown
│   │   ├── profile/page.tsx
│   │   ├── profile/edit/page.tsx
│   │   ├── legal/tos/page.tsx
│   │   └── legal/privacy/page.tsx
│   └── api/
│       ├── duplicate-check/route.ts    ← GLM writes the logic
│       ├── detect-slip/route.ts        ← Anthropic OCR API call
│       └── split-cost/route.ts         ← Fare engine wrapper
├── components/
│   ├── ui/                             ← Nemotron builds all primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Dialog.tsx
│   │   ├── Skeleton.tsx
│   │   └── Toast.tsx
│   ├── travel/
│   │   ├── TravelCard.tsx              ← Feed item card
│   │   ├── TravelForm.tsx              ← Multi-step host form
│   │   ├── DuplicateModal.tsx          ← Mystery Feature UI ⭐
│   │   ├── SeatMap.tsx                 ← Visual seat grid
│   │   └── JoinRequestModal.tsx
│   ├── route/
│   │   ├── SVGRouteMap.tsx             ← Simulated route (default)
│   │   ├── WaypointPicker.tsx
│   │   └── RoutePreview.tsx
│   ├── cost/
│   │   ├── BillModal.tsx
│   │   ├── CostBreakdown.tsx
│   │   └── SlipUploader.tsx
│   └── chat/
│       ├── ChatWindow.tsx
│       ├── MessageBubble.tsx
│       └── ChatInput.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── fare-engine.ts                  ← GLM writes this
│   ├── duplicate-detector.ts           ← GLM writes this
│   ├── route-utils.ts                  ← Haversine coordinate math
│   └── mock-data.ts                    ← Demo fallback data
├── types/index.ts                      ← All shared TypeScript types
├── supabase/
│   ├── schema.sql
│   ├── rls.sql
│   └── seed.sql
└── .env.local.example
```

---

## 🤖 LLM Delegation Rules

### Nemotron 3 Ultra — Use by Default (Unlimited)

Use for **everything visual and compositional:**

- All React components in `/components/**`
- All page components in `/app/**`
- Tailwind class design, responsive layouts, dark mode
- CVA variant definitions for all composites
- Framer Motion animations (state feedback only — zero decorative motion)
- SVG route map visualization (`SVGRouteMap.tsx`)
- react-hook-form + Zod form components
- `/lib/mock-data.ts` — all fallback demo data
- `/app/api/detect-slip/route.ts` — Anthropic API wrapper

### GLM 5.3 Flash — High-Precision Reserve (Limited)

> 💰 Treat each GLM call as a $10 budget spend. Use ONLY for logic, SQL, and algorithms.

**Reserve ONLY for:**

- `/supabase/schema.sql` — all table definitions, triggers, functions
- `/supabase/rls.sql` — all Row Level Security policies
- `/lib/fare-engine.ts` — the full KM cost split implementation
- `/lib/duplicate-detector.ts` — similarity scoring + pg\_trgm query
- `/app/api/split-cost/route.ts` — fare engine API route
- Debugging Supabase RLS failures or complex TypeScript inference errors

**Total GLM calls needed:** \~3 (schema + fare engine + duplicate detector)

---

## 🔑 Environment Variables

```env
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only: NEVER expose to client
ANTHROPIC_API_KEY=                 # slip OCR (claude-sonnet-4-6)
RESEND_API_KEY=                    # email notifications
NEXT_PUBLIC_GOOGLE_MAPS_KEY=       # optional: leave empty to keep SVG mode
```

---

## 🛡 Fallback Guardrails

| Feature | Primary | Fallback |
| --- | --- | --- |
| Ride feed | Supabase query | `MOCK_TRAVELS` from `/lib/mock-data.ts` |
| Slip OCR | Anthropic API | Manual PKR amount input field (auto-shown on failure) |
| Duplicate check | pg\_trgm algorithm | Skip silently — post always succeeds |
| Maps | Google Maps (if key present) | SVG route simulation (always the default) |
| Realtime | Supabase Realtime channel | 30s polling + "Live updates paused" pill |
| Email | Resend API | In-app notification only, no crash |

---

## 🎨 Design Tokens

```css
/* Add to globals.css — Apple-inspired semantic tokens */
:root {
  --bg-canvas:    #FFFFFF;
  --bg-elevated:  #F5F5F7;
  --fg-primary:   #1D1D1F;
  --fg-secondary: #6E6E73;
  --fg-tertiary:  #AEAEB2;
  --border:       #D2D2D7;
  --border-focus: #007AFF;
  --brand:        #007AFF;
  --brand-hover:  #0071E3;
  --ok:           #34C759;
  --warn:         #FF9F0A;
  --error:        #FF3B30;
  --radius-sm:    8px;
  --radius-md:    12px;
  --radius-lg:    16px;
  --radius-pill:  100px;
  --shadow-sm:    0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:    0 4px 16px rgba(0,0,0,0.12);
  --shadow-lg:    0 8px 32px rgba(0,0,0,0.16);
}

[data-theme="dark"] {
  --bg-canvas:    #000000;
  --bg-elevated:  #1C1C1E;
  --fg-primary:   #F5F5F7;
  --fg-secondary: #98989D;
  --fg-tertiary:  #636366;
  --border:       #3A3A3C;
  --brand:        #0A84FF;
  --brand-hover:  #409CFF;
  --ok:           #30D158;
  --warn:         #FF9F0A;
  --error:        #FF453A;
}
```

---

## 📋 Phase Build Checklist

```
⏱ PHASE 1 — Auth & Profile (1 hour)
[ ] Run schema.sql in Supabase SQL Editor
[ ] Run rls.sql in Supabase SQL Editor
[ ] Enable Realtime for: travels, messages, notifications, travel_members
[ ] Create Storage bucket: bill-slips (private, 10MB max, images only)
[ ] Signup page: email, password, full name, gender (required), city
[ ] Login page with /feed redirect
[ ] Protected route middleware
[ ] Profile edit: phone, vehicle make/model/color/plate, avatar upload

⏱ PHASE 2 — Host & Feed (1.5 hours)
[ ] Host form (multi-step):
    Step 1: Origin + Destination text with autocomplete
    Step 2: Departure date + time, is_recurring toggle + days
    Step 3: Seats, gender preference, pickup radius (1/2/3km), estimated cost PKR
    Step 4: Description + vehicle info + review summary
[ ] On submit: call /api/duplicate-check → DuplicateModal if score > 60%
[ ] Travel feed: TravelCard grid with gender-filtered query
[ ] Search: free-text, partial match on origin OR destination
[ ] Filters: departure date, max price, available seats only toggle
[ ] Realtime: new travels push to feed without page refresh
[ ] available_seats badge on each card, "Full" state hides from feed

⏱ PHASE 3 — Route, Waypoints & Chat (1.5 hours)
[ ] SVGRouteMap: origin → waypoints → destination, animated line drawing
[ ] WaypointPicker: host adds mid-route stops with label + km_from_origin
[ ] Mid-route join: requester selects waypoint, km_from_origin auto-sets
[ ] Host approval UI: requests list, Accept / Reject buttons
[ ] Travel lock button (host only after seats filled OR manual)
[ ] In-app group chat per travel (Supabase Realtime messages table)
[ ] System messages: "Ali Hassan joined", "Travel locked by host"
[ ] Phone number visible ONLY after accepted (not on public profile)

⏱ PHASE 4 — Cost Split & AI Slip (1 hour)
[ ] Bill modal: image upload → Supabase Storage
[ ] Anthropic OCR: image → claude-sonnet-4-6 → extract PKR total
[ ] fare-engine.ts: calculate breakdown per member
[ ] Cost breakdown receipt card: visible to ALL members
[ ] Payment acknowledgement button per member
[ ] Export receipt as downloadable image

⏱ PHASE 5 — Duplicate Detector (1 hour)
[ ] /api/duplicate-check: pg_trgm query + JS scoring
[ ] DuplicateModal: similarity progress bar, reason pills, Merge/Keep CTA
[ ] Merge API: transfer requests, set secondary to status='merged', notify
[ ] "Similar rides exist" banner for 40–60% score zone

⏱ PHASE 6 — Polish & Deploy (0.5 hours)
[ ] /legal/tos page (boilerplate with real legal language)
[ ] /legal/privacy page
[ ] Email via Resend: request received, accepted, travel locked, bill submitted
[ ] Dark mode QA on all pages
[ ] seed.sql: 5 demo travels including one near-duplicate pair for demo
[ ] Deploy to Vercel, set all env vars
[ ] Final end-to-end demo walkthrough
```
