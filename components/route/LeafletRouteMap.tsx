'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { SVGRouteMap } from './SVGRouteMap'
import { shortestRouteBetween, GRAPH_NODES } from '@/lib/route-graph'
// Leaflet's stylesheet is required — without it the panes/tiles render
// unpositioned and the map appears as a blank box.
import 'leaflet/dist/leaflet.css'

export interface WaypointForMap {
  id: string
  label: string
  km_from_origin: number
  sort_order: number
  lat?: number | null
  lng?: number | null
  pickup_radius_km?: number
}

export interface LeafletRouteMapProps {
  origin: string
  destination: string
  waypoints: WaypointForMap[]
  totalKm: number
  pickupRadiusKm?: 1 | 2 | 3
  originLat?: number | null
  originLng?: number | null
  destinationLat?: number | null
  destinationLng?: number | null
  className?: string
  onRouteCalculated?: (km: number, durationMin: number) => void
}

/**
 * Well-known Pakistani city coordinates — used as the FIRST coordinate source
 * (keyless, instant) before falling back to Nominatim geocoding. Guarantees a
 * real distance via Haversine even when geocoding/OSRM are unreachable.
 */
const CITY_COORDS: Record<string, [number, number]> = {
  'Lahore': [31.5204, 74.3587], 'Islamabad': [33.6844, 73.0479],
  'Rawalpindi': [33.6007, 73.0679], 'Murree': [33.9062, 73.3903],
  'Karachi': [24.8607, 67.0011], 'Peshawar': [34.0151, 71.5249],
  'Multan': [30.1575, 71.5249], 'Faisalabad': [31.4504, 73.1350],
  'Sialkot': [32.4945, 74.5229], 'Nathia Gali': [33.9833, 73.3833],
  'Abbottabad': [34.1463, 73.2117], 'Naran': [34.9008, 73.6511],
  'Kaghan': [34.7667, 73.5833], 'Hunza': [36.3167, 74.6500],
}

function cityCoords(text: string): { lat: number; lng: number } | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  // Exact match first, then a "contains" match (e.g. "Lahore, Punjab")
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (t === name.toLowerCase()) return { lat: coords[0], lng: coords[1] }
  }
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (t.includes(name.toLowerCase())) return { lat: coords[0], lng: coords[1] }
  }
  return null
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/**
 * Leaflet Route Map — uses OpenStreetMap tiles + OSRM for real road routing.
 * Falls back to straight-line if geocoding/routing fails.
 */
export function LeafletRouteMap({
  origin,
  destination,
  waypoints,
  totalKm,
  pickupRadiusKm = 2,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  className,
  onRouteCalculated,
}: LeafletRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [loading, setLoading] = useState(true)
  // Any init/geocode/tile failure degrades to the animated SVG route map so a
  // visual map is ALWAYS displayed.
  const [useFallback, setUseFallback] = useState(false)
  const [routeCalculated, setRouteCalculated] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: any = null
    let L: any = null

    const initMap = async () => {
      try {
        // Dynamic import Leaflet
        const leaflet = await import('leaflet')
        L = leaflet.default

        // Fix Leaflet default icon URL issue with webpack
        delete L.Icon.Default.prototype._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        if (!mapRef.current || cancelled) return

        // Initialize map centered on Pakistan as fallback
        map = L.map(mapRef.current, {
          zoomControl: true,
          attributionControl: false,
        }).setView([30.3753, 69.3451], 6)

        mapInstanceRef.current = map

        // Leaflet renders 0-size tiles when the container resizes after init
        // (tab switches, mobile layout). Invalidate on any container resize.
        const resizeObserver = new ResizeObserver(() => {
          if (!cancelled) map.invalidateSize()
        })
        resizeObserver.observe(mapRef.current)
        observerRef.current = resizeObserver

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        const geocode = async (text: string): Promise<{ lat: number; lng: number } | null> => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ', Pakistan')}&format=json&limit=1`,
              { headers: { 'User-Agent': 'CoolCarPool/1.0' } }
            )
            const data = await response.json()
            if (data.length > 0) {
              return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
            }
          } catch (e) {
            console.warn('[LeafletRouteMap] geocode failed:', e)
          }
          return null
        }

        // Geocode origin and destination if lat/lng not provided.
        // Order: saved coords → CITY_COORDS (instant) → Nominatim.
        let oLat = originLat
        let oLng = originLng
        let dLat = destinationLat
        let dLng = destinationLng

        const oCity = cityCoords(origin)
        const dCity = cityCoords(destination)

        if (oLat == null || oLng == null) {
          const geo = oCity ?? (await geocode(origin))
          if (geo) { oLat = geo.lat; oLng = geo.lng }
        }
        if (dLat == null || dLng == null) {
          const geo = dCity ?? (await geocode(destination))
          if (geo) { dLat = geo.lat; dLng = geo.lng }
        }

        if (cancelled) return

        if (oLat == null || oLng == null || dLat == null || dLng == null) {
          throw new Error('Could not geocode origin/destination')
        }

        // Fetch the real road route from OSRM — primary demo server plus a
        // free fallback; each gets one attempt (the demo server rate-limits).
        let routeCoords: [number, number][] = []
        let routeDistance = haversineKm([oLat, oLng], [dLat, dLng])
        let routeDuration = routeDistance
        let usedStraightLine = false

        const osrmServers = [
          'https://router.project-osrm.org',
          'https://routing.openstreetmap.de/routed-car',
        ]
        const coordStr = `${oLng},${oLat};${dLng},${dLat}`
        for (const server of osrmServers) {
          try {
            const response = await fetch(
              `${server}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`,
              { headers: { 'User-Agent': 'CoolCarPool/1.0' } }
            )
            const data = await response.json()
            if (data.routes && data.routes.length > 0) {
              const route = data.routes[0]
              // OSRM returns [lng, lat] pairs
              routeCoords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
              routeDistance = route.distance / 1000 // km
              routeDuration = route.duration / 60 // minutes
              break
            }
          } catch (e) {
            console.warn(`[LeafletRouteMap] OSRM (${server}) failed:`, e)
          }
        }

        // If OSRM failed, route over the Pakistan highway graph with A*
        // (shortest path through real cities — believable polyline + km).
        // Skips intra-city pairs: both endpoints resolve to the same node,
        // where a road graph between cities has nothing to offer.
        if (routeCoords.length === 0) {
          const shortest = shortestRouteBetween(origin, destination)
          if (shortest && shortest.path.length >= 2) {
            const pathNodes = shortest.path
              .map((name) => GRAPH_NODES.find((n) => n.name.toLowerCase() === name.toLowerCase()))
              .filter((n): n is NonNullable<typeof n> => Boolean(n))
            if (pathNodes.length >= 2) {
              routeCoords = pathNodes.map((n) => [n.lat, n.lng] as [number, number])
              routeDistance = shortest.totalKm
              routeDuration = shortest.totalKm // ~60 km/h
            }
          }
        }

        // Last resort: straight line between the endpoints. Drawn DASHED so it
        // never pretends to be a road the vehicle would actually drive.
        if (routeCoords.length === 0) {
          routeCoords = [[oLat, oLng], [dLat, dLng]]
          usedStraightLine = true
          // Approximate distance using haversine
          const R = 6371
          const dLatRad = ((dLat - oLat) * Math.PI) / 180
          const dLngRad = ((dLng - oLng) * Math.PI) / 180
          const a =
            Math.sin(dLatRad / 2) ** 2 +
            Math.cos((oLat * Math.PI) / 180) *
              Math.cos((dLat * Math.PI) / 180) *
              Math.sin(dLngRad / 2) ** 2
          routeDistance = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          // Rough 60 km/h → 1 minute per km
          routeDuration = routeDistance
        }

        // Draw route polyline — mockup look: soft glow casing + crisp green line.
        // A straight-line fallback renders dashed so it never fakes a road.
        if (routeCoords.length >= 2) {
          if (!usedStraightLine) {
            // Glow casing (dark + soft green halo) — real roads only
            L.polyline(routeCoords, {
              color: '#101408',
              weight: 10,
              opacity: 0.35,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(map)
            L.polyline(routeCoords, {
              color: '#9be96b',
              weight: 4.5,
              opacity: 0.35,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(map)
          }
          // Crisp main line (dashed when it's only an approximation)
          L.polyline(routeCoords, {
            color: '#9be96b',
            weight: 4,
            opacity: usedStraightLine ? 0.7 : 0.95,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: usedStraightLine ? '8 10' : undefined,
          }).addTo(map)
        }

        // Origin marker (glowing green pin — CSS pulse)
        L.marker([oLat, oLng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
              <span style="position:absolute;inset:-6px;border-radius:50%;background:rgba(155,233,107,0.45);animation:ccp-pin-pulse 1.8s ease-out infinite;"></span>
              <span style="width:28px;height:28px;border-radius:50%;background:#9be96b;border:3px solid #101408;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;"></span>
            </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        })
          .addTo(map)
          .bindPopup(`<strong>${origin}</strong><br>Origin`)

        // Destination marker (red)
        L.marker([dLat, dLng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="width: 28px; height: 28px; border-radius: 50%; background: #ef4444; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        })
          .addTo(map)
          .bindPopup(`<strong>${destination}</strong><br>Destination`)

        // Waypoint markers (orange)
        const sortedWaypoints = [...waypoints].sort((a, b) => a.sort_order - b.sort_order)
        for (const wp of sortedWaypoints) {
          let wpLat = wp.lat
          let wpLng = wp.lng
          if (wpLat == null || wpLng == null) {
            // Approximate position along route
            const progress = totalKm > 0 ? wp.km_from_origin / totalKm : 0
            wpLat = oLat + progress * (dLat - oLat)
            wpLng = oLng + progress * (dLng - oLng)
          }

          const marker = L.marker([wpLat, wpLng], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: `<div style="width: 22px; height: 22px; border-radius: 50%; background: #f97316; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.2);"><span style="font-size: 10px; color: white; font-weight: bold;">${wp.sort_order + 1}</span></div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            }),
          }).addTo(map)

          // Pickup radius circle
          if (wp.pickup_radius_km && wp.pickup_radius_km > 0) {
            const radiusMeters = wp.pickup_radius_km * 1000
            L.circle([wpLat, wpLng], {
              radius: radiusMeters,
              color: '#9be96b',
              fillColor: '#9be96b',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '6, 6',
            }).addTo(map)
          }

          marker.bindPopup(`<strong>${wp.label}</strong>${wp.km_from_origin > 0 ? `<br><span>${wp.km_from_origin} km</span>` : ''}`)
        }

        // Fit bounds to show entire route
        const allCoords = [[oLat, oLng], [dLat, dLng], ...sortedWaypoints
          .filter(w => w.lat != null && w.lng != null)
          .map(w => [w.lat!, w.lng!])]
        const bounds = L.latLngBounds(allCoords)
        map.fitBounds(bounds, { padding: [40, 40] })

        // Call callback with calculated route info
        if (onRouteCalculated) {
          onRouteCalculated(Math.round(routeDistance * 10) / 10, Math.round(routeDuration))
        }

        setRouteCalculated(true)
      } catch (e) {
        if (!cancelled) {
          console.warn('[LeafletRouteMap] falling back to SVG map:', e)
          setUseFallback(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (map) {
        map.remove()
        mapInstanceRef.current = null
      }
    }
  }, [origin, destination, waypoints, totalKm, pickupRadiusKm, originLat, originLng, destinationLat, destinationLng])

  // NOTE: the map container div is ALWAYS mounted. The loading skeleton and
  // SVG fallback are overlays — if this component returned early while
  // loading, mapRef.current would be null when initMap runs and Leaflet
  // would never initialize (the "no route preview" bug).
  return (
    <div
      className={cn('relative z-0 isolate rounded-3xl overflow-hidden', className)}
      style={{ height: 384, minHeight: 320, width: '100%' }}
      aria-label={`Route from ${origin} to ${destination}`}
    >
      {/* Map container — permanent ref target */}
      <div ref={mapRef} className="absolute inset-0" aria-hidden={useFallback} />

      {useFallback ? (
        <div className="absolute inset-0">
          <SVGRouteMap
            origin={origin}
            destination={destination}
            waypoints={waypoints}
            totalKm={totalKm}
            pickupRadiusKm={pickupRadiusKm}
            animate
          />
        </div>
      ) : loading ? (
        <div className="absolute inset-0" aria-busy="true" aria-label="Loading map...">
          <Skeleton className="h-full w-full rounded-3xl" />
          {/* Centered pulsing pin while tiles + route load */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="relative flex h-12 w-12 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-25" />
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand shadow-soft">
                <MapPin className="h-5 w-5 text-brand-ink" />
              </span>
            </span>
            <span className="text-xs font-medium text-ink-secondary">Finding the best route…</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}