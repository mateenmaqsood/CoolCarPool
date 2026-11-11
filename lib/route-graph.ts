/**
 * Pakistan highway route graph + classic shortest-path algorithms.
 *
 * Nodes: major Pakistani cities (with real coordinates).
 * Edges: real highway corridors (motorways M-2/M-3/M-4, N-5, etc.) with
 *        approximate road distances in km.
 *
 * Exposes:
 *   - dijkstraShortestPath(from, to)  — uniform-cost search with a binary heap
 *   - aStarShortestPath(from, to)     — A* with a Haversine admissible heuristic
 *
 * Used as the middle tier of the route-distance chain:
 *   OSRM (real road geometry) → A-Star / Dijkstra over this graph → straight line.
 * Guarantees a believable route polyline + realistic km even when OSRM is
 * unreachable, and never returns 0 km.
 */

export interface GraphNode {
  name: string
  lat: number
  lng: number
}

export const GRAPH_NODES: GraphNode[] = [
  { name: 'Karachi', lat: 24.8607, lng: 67.0011 },
  { name: 'Hyderabad', lat: 25.396, lng: 68.3578 },
  { name: 'Sukkur', lat: 27.7052, lng: 68.8574 },
  { name: 'Multan', lat: 30.1575, lng: 71.5249 },
  { name: 'Bahawalpur', lat: 29.3956, lng: 71.6836 },
  { name: 'DG Khan', lat: 30.0489, lng: 70.6403 },
  { name: 'Faisalabad', lat: 31.4504, lng: 73.135 },
  { name: 'Lahore', lat: 31.5204, lng: 74.3587 },
  { name: 'Sialkot', lat: 32.4945, lng: 74.5229 },
  { name: 'Gujranwala', lat: 32.1877, lng: 74.1945 },
  { name: 'Jhang', lat: 31.2781, lng: 72.3317 },
  { name: 'Rawalpindi', lat: 33.6007, lng: 73.0679 },
  { name: 'Islamabad', lat: 33.6844, lng: 73.0479 },
  { name: 'Abbottabad', lat: 34.1463, lng: 73.2117 },
  { name: 'Nathia Gali', lat: 33.9833, lng: 73.3833 },
  { name: 'Murree', lat: 33.9062, lng: 73.3903 },
  { name: 'Peshawar', lat: 34.0151, lng: 71.5249 },
  { name: 'Mardan', lat: 34.1989, lng: 72.0231 },
  { name: 'Quetta', lat: 30.1798, lng: 66.975 },
  { name: 'Sargodha', lat: 32.0836, lng: 72.6711 },
  { name: 'Muzaffargarh', lat: 30.0736, lng: 71.1809 },
  { name: 'Khanewal', lat: 30.3017, lng: 71.9321 },
  { name: 'Sahiwal', lat: 30.6682, lng: 73.1114 },
  { name: 'Gujrat', lat: 32.5731, lng: 74.0789 },
  { name: 'Naran', lat: 34.9008, lng: 73.6511 },
  { name: 'Hunza', lat: 36.3167, lng: 74.65 },
  { name: 'Gilgit', lat: 35.9208, lng: 74.3144 },
]

/** Undirected highway edges: [cityA, cityB, roadKm]. */
const GRAPH_EDGES: Array<[string, string, number]> = [
  ['Karachi', 'Hyderabad', 160],
  ['Hyderabad', 'Sukkur', 320],
  ['Sukkur', 'Multan', 320],
  ['Sukkur', 'Quetta', 330],
  ['Multan', 'Bahawalpur', 100],
  ['Multan', 'Khanewal', 30],
  ['Multan', 'Muzaffargarh', 15],
  ['Multan', 'DG Khan', 95],
  ['Khanewal', 'Faisalabad', 165],
  ['Bahawalpur', 'Sahiwal', 130],
  ['Sahiwal', 'Lahore', 165],
  ['Faisalabad', 'Lahore', 145], // M-3
  ['Faisalabad', 'Jhang', 80],
  ['Faisalabad', 'Sargodha', 115],
  ['Jhang', 'Sargodha', 90],
  ['Sargodha', 'Rawalpindi', 190],
  ['Lahore', 'Gujranwala', 70],
  ['Gujranwala', 'Gujrat', 55],
  ['Gujrat', 'Sialkot', 45],
  ['Gujrat', 'Rawalpindi', 190], // M-2 via Islamabad
  ['Lahore', 'Rawalpindi', 375], // M-2
  ['Lahore', 'Multan', 320], // M-4 corridor via Khanewal approx
  ['Rawalpindi', 'Islamabad', 15],
  ['Islamabad', 'Peshawar', 180], // M-1
  ['Peshawar', 'Mardan', 60],
  ['Rawalpindi', 'Abbottabad', 110],
  ['Abbottabad', 'Naran', 155],
  ['Naran', 'Gilgit', 190],
  ['Gilgit', 'Hunza', 100],
  ['Rawalpindi', 'Murree', 60],
  ['Murree', 'Nathia Gali', 30],
  ['Nathia Gali', 'Abbottabad', 35],
  ['Muzaffargarh', 'DG Khan', 85],
  ['Multan', 'Lahore', 310], // N-5 alternative
]

export type ShortestPathResult = {
  /** City names along the path, including endpoints. Empty when unreachable. */
  path: string[]
  /** Total road km along the path. */
  totalKm: number
  algorithm: 'dijkstra' | 'astar'
}

/* ------------------------------------------------------------------ */
/* Graph helpers                                                       */
/* ------------------------------------------------------------------ */

const nodeByName = new Map(GRAPH_NODES.map((n) => [n.name.toLowerCase(), n]))

function lookup(name: string): GraphNode | null {
  const t = name.trim().toLowerCase()
  if (!t) return null
  // Exact, then substring ("Lahore, Punjab" → Lahore)
  if (nodeByName.has(t)) return nodeByName.get(t)!
  for (const [key, n] of Array.from(nodeByName.entries())) {
    if (t.includes(key)) return n
  }
  return null
}

/** Adjacency list: city name (lower) → [{ to, km }] */
const adjacency = new Map<string, Array<{ to: string; km: number }>>()
for (const [a, b, km] of GRAPH_EDGES) {
  if (!adjacency.has(a.toLowerCase())) adjacency.set(a.toLowerCase(), [])
  if (!adjacency.has(b.toLowerCase())) adjacency.set(b.toLowerCase(), [])
  adjacency.get(a.toLowerCase())!.push({ to: b, km })
  adjacency.get(b.toLowerCase())!.push({ to: a, km })
}

export function haversineKmGraph(a: GraphNode, b: GraphNode): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Binary min-heap priority queue for (name, priority) pairs. */
class MinHeap {
  private heap: Array<{ key: string; priority: number }> = []

  push(key: string, priority: number) {
    this.heap.push({ key, priority })
    let i = this.heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.heap[parent].priority <= this.heap[i].priority) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  pop(): { key: string; priority: number } | null {
    if (this.heap.length === 0) return null
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = 2 * i + 2
        let smallest = i
        if (l < this.heap.length && this.heap[l].priority < this.heap[smallest].priority) smallest = l
        if (r < this.heap.length && this.heap[r].priority < this.heap[smallest].priority) smallest = r
        if (smallest === i) break
        ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
        i = smallest
      }
    }
    return top
  }

  get size() {
    return this.heap.length
  }
}

function reconstructPath(
  cameFrom: Map<string, string>,
  start: string,
  goal: string,
): string[] {
  const path: string[] = []
  let cur = goal
  while (cur) {
    path.push(cur)
    if (cur === start) break
    cur = cameFrom.get(cur) ?? ''
    if (!cur) return [] // broken chain — shouldn't happen
  }
  return path.reverse()
}

/* ------------------------------------------------------------------ */
/* Dijkstra — uniform cost search, binary min-heap                     */
/* ------------------------------------------------------------------ */

export function dijkstraShortestPath(from: string, to: string): ShortestPathResult {
  const start = lookup(from)
  const goal = lookup(to)
  if (!start || !goal) return { path: [], totalKm: 0, algorithm: 'dijkstra' }

  const startKey = start.name.toLowerCase()
  const goalKey = goal.name.toLowerCase()

  const dist = new Map<string, number>([[startKey, 0]])
  const cameFrom = new Map<string, string>()
  const visited = new Set<string>()
  const queue = new MinHeap()
  queue.push(startKey, 0)

  while (queue.size > 0) {
    const current = queue.pop()!
    const key = current.key
    if (visited.has(key)) continue
    visited.add(key)

    if (key === goalKey) break

    const neighbours = adjacency.get(key) ?? []
    for (const edge of neighbours) {
      const toKey = edge.to.toLowerCase()
      if (visited.has(toKey)) continue
      const nextDist = (dist.get(key) ?? Infinity) + edge.km
      if (nextDist < (dist.get(toKey) ?? Infinity)) {
        dist.set(toKey, nextDist)
        cameFrom.set(toKey, key)
        queue.push(toKey, nextDist)
      }
    }
  }

  if (!dist.has(goalKey)) return { path: [], totalKm: 0, algorithm: 'dijkstra' }
  return {
    path: reconstructPath(cameFrom, startKey, goalKey),
    totalKm: Math.round(dist.get(goalKey)!),
    algorithm: 'dijkstra',
  }
}

/* ------------------------------------------------------------------ */
/* A* — Dijkstra + admissible Haversine heuristic                      */
/* ------------------------------------------------------------------ */

export function aStarShortestPath(from: string, to: string): ShortestPathResult {
  const start = lookup(from)
  const goal = lookup(to)
  if (!start || !goal) return { path: [], totalKm: 0, algorithm: 'astar' }

  const startKey = start.name.toLowerCase()
  const goalKey = goal.name.toLowerCase()

  const gScore = new Map<string, number>([[startKey, 0]])
  const cameFrom = new Map<string, string>()
  const closed = new Set<string>()
  const open = new MinHeap()
  // f = g + h — heuristic never overestimates (straight line ≤ road distance)
  open.push(startKey, haversineKmGraph(start, goal))

  while (open.size > 0) {
    const current = open.pop()!
    const key = current.key
    if (key === goalKey) break
    if (closed.has(key)) continue
    closed.add(key)

    for (const edge of adjacency.get(key) ?? []) {
      const toKey = edge.to.toLowerCase()
      if (closed.has(toKey)) continue
      const tentative = (gScore.get(key) ?? Infinity) + edge.km
      if (tentative < (gScore.get(toKey) ?? Infinity)) {
        gScore.set(toKey, tentative)
        cameFrom.set(toKey, key)
        const node = nodeByName.get(toKey)!
        const h = haversineKmGraph(node, goal)
        open.push(toKey, tentative + h)
      }
    }
  }

  if (!gScore.has(goalKey)) return { path: [], totalKm: 0, algorithm: 'astar' }
  return {
    path: reconstructPath(cameFrom, startKey, goalKey),
    totalKm: Math.round(gScore.get(goalKey)!),
    algorithm: 'astar',
  }
}

/**
 * Convenience: shortest path between two free-text locations using A*
 * (falls back to Dijkstra result if A* finds nothing — they agree on this
 * graph, but belt-and-suspenders).
 */
export function shortestRouteBetween(from: string, to: string): ShortestPathResult | null {
  const a = aStarShortestPath(from, to)
  if (a.path.length > 0) return a
  const d = dijkstraShortestPath(from, to)
  return d.path.length > 0 ? d : null
}
