# CoolCarPool — GLM_PROMPT.md

## How to Use This File
Use **GLM 5.3 Flash** strictly for high-precision logic, complex algorithm code, database scripts, RLS policies, and server API handlers. Treat each GLM call as high-value execution.

---

## GLM Task Checklist & Reference Files

Refer to the following project specifications when executing tasks:
- Database Schema & RLS Policies: Refer to `CoolCarPool — SCHEMA.md`
- Core Domain Rules & Math Formula: Refer to `CoolCarPool — CLAUDE.md`
- Step-by-Step Phase Checklist: Refer to `CoolCarPool — PHASES.md`

---

## GLM Execution Prompt 1: Supabase Setup & Auth Logic

**Files to Generate:**
1. `lib/supabase/client.ts`: Supabase browser client setup using `@supabase/ssr`.
2. `lib/supabase/server.ts`: Supabase server client for Server Components, Server Actions, and Route Handlers with cookie handling.
3. `middleware.ts`: Next.js middleware enforcing session check and route protection:
   - Protected routes: `/feed`, `/host`, `/travel/*`, `/profile/*`.
   - Guest routes: `/login`, `/signup`.

---

## GLM Execution Prompt 2: Cost Splitting Fare Engine (`lib/fare-engine.ts`)

Implement the exact KM-based cost splitting formula in TypeScript:

$$ \text{perKmRate} = \frac{\text{totalBillPkr}}{\text{totalTripKm}} $$

```typescript
export interface TravelMemberCostInput {
  userId: string;
  fullName: string;
  isHost: boolean;
  isFullRoute: boolean;
  kmFromOrigin: number; // 0 for full route or origin pickup
}

export interface CalculateFareParams {
  totalBillPkr: number;
  totalTripKm: number;
  members: TravelMemberCostInput[];
}

export interface MemberFareOutput {
  userId: string;
  fullName: string;
  isHost: boolean;
  isFullRoute: boolean;
  kmCovered: number;
  farePkr: number;
  sharePercentage: number;
}

export interface FareEngineResult {
  totalBillPkr: number;
  totalTripKm: number;
  perKmRatePkr: number;
  midRouteTotalPkr: number;
  remainingBillPkr: number;
  fullRouteFareHeadPkr: number;
  memberBreakdown: MemberFareOutput[];
}

export function calculateTripFares(params: CalculateFareParams): FareEngineResult {
  const { totalBillPkr, totalTripKm, members } = params;

  if (totalTripKm <= 0) throw new Error("Total trip KM must be greater than 0");
  if (totalBillPkr <= 0) throw new Error("Total bill PKR must be greater than 0");

  const perKmRatePkr = totalBillPkr / totalTripKm;

  const midRouteMembers = members.filter((m) => !m.isHost && !m.isFullRoute);
  const fullRouteMembers = members.filter((m) => m.isHost || m.isFullRoute);

  let midRouteTotalPkr = 0;
  const breakdown: MemberFareOutput[] = [];

  // 1. Process mid-route travelers
  midRouteMembers.forEach((m) => {
    const kmCovered = Math.max(0, totalTripKm - m.kmFromOrigin);
    const farePkr = Math.round(kmCovered * perKmRatePkr);
    midRouteTotalPkr += farePkr;

    breakdown.push({
      userId: m.userId,
      fullName: m.fullName,
      isHost: false,
      isFullRoute: false,
      kmCovered,
      farePkr,
      sharePercentage: Number(((farePkr / totalBillPkr) * 100).toFixed(1)),
    });
  });

  // 2. Process full-route travelers (Host included)
  const remainingBillPkr = Math.max(0, totalBillPkr - midRouteTotalPkr);
  const fullRouteCount = fullRouteMembers.length || 1;
  const fullRouteFareHeadPkr = Math.round(remainingBillPkr / fullRouteCount);

  fullRouteMembers.forEach((m) => {
    breakdown.push({
      userId: m.userId,
      fullName: m.fullName,
      isHost: m.isHost,
      isFullRoute: true,
      kmCovered: totalTripKm,
      farePkr: fullRouteFareHeadPkr,
      sharePercentage: Number(((fullRouteFareHeadPkr / totalBillPkr) * 100).toFixed(1)),
    });
  });

  return {
    totalBillPkr,
    totalTripKm,
    perKmRatePkr: Number(perKmRatePkr.toFixed(2)),
    midRouteTotalPkr,
    remainingBillPkr,
    fullRouteFareHeadPkr,
    memberBreakdown: breakdown,
  };
}
```

Write the accompanying API route `app/api/split-cost/route.ts` to accept POST requests with trip parameters and return the JSON payload calculated by `calculateTripFares`.

---

## GLM Execution Prompt 3: Duplicate Detector (`lib/duplicate-detector.ts` & `/api/duplicate-check`)

Implement Card 3 Duplicate Detection algorithm using Supabase Postgres `pg_trgm` + JS scoring engine.

**Requirements:**
1. SQL Similarity Search: Query open travels using `similarity(origin_text, $1)` and `similarity(destination_text, $2)`.
2. Scoring Matrix:
   - Origin Similarity $\times 0.30$
   - Destination Similarity $\times 0.30$
   - Same Calendar Date $\times 0.20$
   - Time Proximity: $\le 1\text{h} \rightarrow 1.0, \le 2\text{h} \rightarrow 0.7, \le 6\text{h} \rightarrow 0.3$, else $0 \times 0.15$
   - Gender Preference Match: Exact $\rightarrow 1.0$, either is 'any' $\rightarrow 0.5$, else $0 \times 0.05$
3. Score threshold handling:
   - Score $\ge 60\%$: Return match with list of reason strings.
   - Score $40–60\%$: Return match marked for subtle banner.
   - Score $< 40\%$: Ignore match.

Write both `lib/duplicate-detector.ts` and `app/api/duplicate-check/route.ts`.