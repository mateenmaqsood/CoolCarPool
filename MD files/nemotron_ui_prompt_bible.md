# CoolCarPool — NEMOTRON_PROMPT.md

## How to Use This File
Copy and paste the **Master System Prompt** below into your Nemotron 3 Ultra sessions whenever you generate UI components, page layouts, Tailwind styles, SVG route renders, or React state logic. Nemotron is your primary unlimited LLM for all frontend visual and compositional work.

---

## Master System Prompt (Paste This First)

```text
You are an expert Next.js 14 App Router & Tailwind CSS UI engineer specializing in Apple-inspired Design Systems. You are building the frontend for "CoolCarPool" — a fast, modern carpool & travel planning application built for a hackathon.

### UI & Styling Guidelines (Apple Design System)
1. Aesthetics: Clean, minimalist, high contrast, subtle borders (`1px solid var(--border)`), rounded corners (`rounded-xl` for cards, `rounded-lg` for inputs/buttons, `rounded-full` for pills/badges).
2. Design Tokens (CSS Variables):
   - Light Mode: Canvas `#FFFFFF`, Elevated `#F5F5F7`, Text Primary `#1D1D1F`, Text Secondary `#6E6E73`, Brand `#007AFF`, OK `#34C759`, Warn `#FF9F0A`, Error `#FF3B30`.
   - Dark Mode (`[data-theme="dark"]`): Canvas `#000000`, Elevated `#1C1C1E`, Text Primary `#F5F5F7`, Text Secondary `#98989D`, Brand `#0A84FF`, OK `#30D158`, Warn `#FF9F0A`, Error `#FF453A`.
   - Never use hardcoded hex values in component classes. Use semantic Tailwind utility classes or custom CSS variables.
3. Architecture:
   - Server Components (RSC) by default for data fetching and static layouts.
   - Use `'use client'` strictly at leaf boundaries (forms, stateful modals, interactive maps, realtime subscriptions).
   - Use `cva` (class-variance-authority) and `clsx`/`tailwind-merge` (`cn` helper) for all dynamic component variants.
4. Icons & Motion:
   - Use `lucide-react` for crisp Apple-style icons.
   - Use `framer-motion` strictly for functional UI feedback (modals, toasts, drawer slide-ups, list item entries). Zero purely decorative background animations.
5. Defensive UI:
   - Every data component MUST support 5 states: Loading (Skeleton), Spinner, Empty State, Error State, and Data Render.
   - Always include fallback mock data imports from `@/lib/mock-data` so components render cleanly if live APIs fail.
```

---

## Phase 1 UI Tasks (Auth, App Shell & Profile)

### Task 1.1: Primitives Scaffold (`/components/ui/`)
Generate type-safe Apple-style UI primitives using `cva`:
- `Button.tsx`: Variants `primary`, `secondary`, `ghost`, `danger`, `outline`. Sizes `sm`, `md`, `lg`, `icon`. Include loading state spinner.
- `Input.tsx`: Label, left/right icon slots, clear button, helper text, red error state.
- `Card.tsx`: Elevated background (`--bg-elevated`), subtle border, hover tilt/border highlight.
- `Badge.tsx`: Pill shape (`rounded-full`), variants `ok` (green), `warn` (orange), `brand` (blue), `neutral` (gray).
- `Avatar.tsx`: Image fallback to initials with gradient background.
- `Dialog.tsx`: Modal overlay (`backdrop-blur-md`), Framer Motion `scale-in` effect, accessible close button.
- `Skeleton.tsx`: Animated pulse placeholder loading bar.
- `Toast.tsx`: Stacked notification alerts with auto-dismiss.

### Task 1.2: App Shell Layout (`/app/(app)/layout.tsx`)
- Top navigation bar with blurred backdrop (`backdrop-blur-xl bg-canvas/80 sticky top-0 z-50`).
- Logo ("CoolCarPool" with car icon), active page tab indicator, Dark Mode toggle switch, and user profile dropdown avatar.
- Mobile-responsive bottom navigation bar for quick access to `Feed`, `Host`, `My Rides`, and `Profile`.

### Task 1.3: Auth & Profile Pages
- `app/(auth)/login/page.tsx`: Clean card layout, email/password inputs, validation feedback, submit button.
- `app/(auth)/signup/page.tsx`: Multi-field form including Gender selection (`male` / `female` segmented toggle button), full name, city, phone, and password.
- `app/(app)/profile/edit/page.tsx`: Profile picture avatar uploader preview, contact details, and host vehicle specs (Make, Model, Color, Plate Number).

---

## Phase 2 UI Tasks (Host Form, Travel Cards & Feed)

### Task 2.1: Multi-Step Travel Host Form (`/app/(app)/host/page.tsx`)
Build a 4-step wizard using `react-hook-form` and `zod`:
- **Step 1 (Route):** Origin city input + Destination city input with quick suggestion pills (Lahore, Islamabad, Murree, Karachi, Rawalpindi).
- **Step 2 (Schedule):** Departure Date Picker, Time Selector, Recurring trip toggle (`is_recurring` + day checkboxes).
- **Step 3 (Capacity & Rules):** Total available seats (1–8 stepper), Gender Preference toggle (`Boys Only` | `Girls Only` | `Any`), Pickup Radius slider (1km, 2km, 3km), Estimated Cost per head (PKR).
- **Step 4 (Review & Submit):** Visual summary card, vehicle preview badge, submit trigger that calls `/api/duplicate-check`.

### Task 2.2: Duplicate Detection Modal (`/components/travel/DuplicateModal.tsx`) ⭐
*TechSOC Card 3 Feature UI*
- Modal header with warning icon and title: **"Similar Rides Found"**.
- Similarity Match Meter: Animated progress bar showing overall score (e.g., `87% Match`).
- Reason Pills: List of specific matches (e.g., `Same Route`, `Same Date`, `55 min apart`, `Gender Compatible`).
- Side-by-side comparison card showing the user's proposed ride vs. the existing target ride.
- Action Buttons:
  - **Merge Travel:** Combines travelers into existing ride, opens shared seat pool.
  - **Keep Separate:** Posts travel as a distinct listing.

### Task 2.3: Ride Feed & Search (`/app/(app)/feed/page.tsx` & `TravelCard.tsx`)
- Search Header: Free-text origin/destination search box with quick date and max-price filters.
- `TravelCard.tsx`:
  - Origin $\rightarrow$ Destination bold header with route distance indicator (`310 km`).
  - Badges: Gender preference (`Boys Only` / `Girls Only`), Available seats left count pill.
  - Departure timestamp relative label (e.g. "Tomorrow at 3:00 PM").
  - Host avatar with name and verified checkmark.
  - Estimated cost tag (`PKR 2,500 / head`).

---

## Phase 3 UI Tasks (Route Map, Waypoints & Realtime Chat)

### Task 3.1: SVG Route Map & Waypoint Picker (`/components/route/`)
- `SVGRouteMap.tsx`:
  - SVG canvas rendering a stylized route polyline connecting Origin $\rightarrow$ Waypoints $\rightarrow$ Destination.
  - Animated dash-offset effect for active trips.
  - Radius circles (1km / 2km / 3km glow effect) around waypoint nodes.
  - Fallback toggle for embedded Google Map view if API key is provided.
- `WaypointPicker.tsx`: Dynamic list where the host can add/remove mid-route pickup locations (e.g., "Islamabad Toll Plaza", `280 km from origin`).

### Task 3.2: Ride Detail & Seat Grid (`/app/(app)/travel/[id]/page.tsx`)
- Visual Seat Grid (`SeatMap.tsx`): Interactive car layout displaying host seat, booked passenger seats, and open seats.
- Join Request Modal (`JoinRequestModal.tsx`): Option for passenger to request full-route seat or pick a mid-route waypoint.
- Host Management Bar: List of pending request cards with single-tap **Accept** / **Reject** buttons.
- Lock Travel Button: High-visibility button for host to lock the ride once full.

### Task 3.3: Realtime Group Chat (`/app/(app)/travel/[id]/chat/page.tsx`)
- `ChatWindow.tsx`: Realtime message stream with Supabase channels.
- `MessageBubble.tsx`: Differentiates between self messages, co-rider messages, and system alerts ("Ali Hassan joined the travel", "Host locked the travel").
- Privacy Guard: Shows full contact phone numbers ONLY after passenger request is accepted by host.

---

## Phase 4 UI Tasks (Cost Split & Receipt UI)

### Task 4.1: Receipt Upload Modal (`/components/cost/SlipUploader.tsx`)
- Drag-and-drop file upload container for receipt images (gas, fuel, toll bills).
- Instant preview image frame with OCR status spinner ("Scanning bill with AI...").
- Fallback UI: If OCR fails to detect amount, render manual PKR text input field.

### Task 4.2: Itemized Bill Receipt Breakdown (`/components/cost/CostBreakdown.tsx`)
- Apple Wallet-style printable receipt card showing:
  - Total Fuel/Toll Bill (PKR).
  - Total Route Distance & Calculated Per-KM Rate.
  - Mid-route passenger breakdown rows (Name, Segment Distance covered, Owed Amount).
  - Full-route passenger & host breakdown rows (Equal share of remaining balance).
- Passenger "Acknowledge / Paid" tap button per row.
- "Export Receipt Image" button to download bill card as PNG/JPEG.

---

## Phase 5 UI Tasks (Duplicate Detector Flow & Polish)

- Wire `DuplicateModal.tsx` directly into the host submission flow.
- Add 40–60% similarity banner variant ("Note: A similar travel exists at 4:00 PM").
- Dark Mode audit across all modals, drawers, input states, and chat bubbles.

---

## Rules to Remind Nemotron If It Drifts
1. Never import raw CSS or write inline style objects — use Tailwind classes and dynamic CSS variables.
2. Never omit responsive flex/grid wrappers (`w-full max-w-4xl mx-auto px-4 sm:px-6`).
3. Always include TypeScript interface props for components.
4. Keep all interactivity inside client components (`'use client'`).