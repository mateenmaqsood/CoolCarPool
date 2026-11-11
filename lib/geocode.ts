/**
 * Free OpenStreetMap Nominatim geocoding helpers (keyless).
 * Used by the host form's address search to convert landmark/address
 * strings ("Packages Mall, Lahore") into coordinates.
 *
 * Rate-limit courtesy: Nominatim asks for max 1 req/sec — the UI debounces
 * to 400ms and only searches on >= 3 characters.
 */

export interface GeoResult {
  /** Display label returned by Nominatim (full address). */
  label: string
  /** Short label — usually the main name/road. */
  shortLabel: string
  lat: number
  lng: number
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

// Rough Pakistan bounding box (west, south, east, north) — keeps results local.
const PK_VIEWBOX = '60.5,23.5,77.5,37.5'

const HEADERS = { 'User-Agent': 'CoolCarPool/1.0 (hackathon ride-sharing app)' }

/** Free-text address search → up to `limit` labelled results. */
export async function searchAddresses(query: string, limit = 5): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  try {
    const url =
      `${NOMINATIM_BASE}/search?q=${encodeURIComponent(q)}` +
      `&format=json&addressdetails=1&limit=${limit}&viewbox=${PK_VIEWBOX}&bounded=0&countrycodes=pk`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return []
    const data = (await res.json()) as Array<{
      display_name: string
      name?: string
      lat: string
      lon: string
    }>

    return data.map((d) => {
      const parts = d.display_name.split(',').map((s) => s.trim())
      return {
        label: d.display_name,
        shortLabel: d.name?.trim() || parts[0] || d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      }
    })
  } catch (e) {
    console.warn('[geocode] search failed:', e)
    return []
  }
}

/** Single-shot lookup for a free-text place. Returns null when not found. */
export async function geocodeAddress(text: string): Promise<{ lat: number; lng: number } | null> {
  const results = await searchAddresses(text, 1)
  return results.length > 0 ? { lat: results[0].lat, lng: results[0].lng } : null
}
