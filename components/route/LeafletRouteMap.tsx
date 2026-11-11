'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { SVGRouteMap } from './SVGRouteMap'
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

        // Geocode origin and destination if lat/lng not provided
        let oLat = originLat
        let oLng = originLng
        let dLat = destinationLat
        let dLng = destinationLng

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

        if (oLat == null || oLng == null) {
          const geo = await geocode(origin)
          if (geo) { oLat = geo.lat; oLng = geo.lng }
        }
        if (dLat == null || dLng == null) {
          const geo = await geocode(destination)
          if (geo) { dLat = geo.lat; dLng = geo.lng }
        }

        if (cancelled) return

        if (oLat == null || oLng == null || dLat == null || dLng == null) {
          throw new Error('Could not geocode origin/destination')
        }

        // Fetch route from OSRM
        let routeCoords: [number, number][] = []
        let routeDistance = 0
        let routeDuration = 0

        try {
          const coordStr = `${oLng},${oLat};${dLng},${dLat}`
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`,
            { headers: { 'User-Agent': 'CoolCarPool/1.0' } }
          )
          const data = await response.json()
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0]
            // OSRM returns [lng, lat] pairs
            routeCoords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
            routeDistance = route.distance / 1000 // km
            routeDuration = route.duration / 60 // minutes
          }
        } catch (e) {
          console.warn('[LeafletRouteMap] OSRM failed, using straight line:', e)
        }

        // If OSRM failed, use straight line
        if (routeCoords.length === 0) {
          routeCoords = [[oLat, oLng], [dLat, dLng]]
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

        // Draw route polyline — mockup look: soft glow casing + crisp green line
        if (routeCoords.length >= 2) {
          // Glow casing (dark + soft green halo)
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
          // Crisp main line
          L.polyline(routeCoords, {
            color: '#9be96b',
            weight: 4,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
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

          marker.bindPopup(`<strong>${wp.label}</strong><br>${wp.km_from_origin} km from origin`)
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

  if (loading) {
    return (
      <div
        className={cn('relative', className)}
        style={{ height: 384, minHeight: 320, width: '100%' }}
        aria-label="Loading map..."
        aria-busy="true"
      >
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
    )
  }

  if (useFallback) {
    return (
      <div
        className={cn('rounded-3xl', className)}
        style={{ minHeight: 320, width: '100%' }}
      >
        <SVGRouteMap
          origin={origin}
          destination={destination}
          waypoints={waypoints}
          totalKm={totalKm}
          pickupRadiusKm={pickupRadiusKm}
          animate
        />
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className={cn('h-96 rounded-3xl overflow-hidden', className)}
      style={{ height: 384, minHeight: 320, width: '100%' }}
      aria-label={`Route from ${origin} to ${destination}`}
    />
  )
}