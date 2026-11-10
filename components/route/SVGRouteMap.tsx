'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export interface WaypointForMap {
  id: string
  label: string
  km_from_origin: number
  sort_order: number
  lat?: number | null
  lng?: number | null
  pickup_radius_km?: number
}

export interface SVGRouteMapProps {
  origin: string
  destination: string
  waypoints: WaypointForMap[]
  totalKm: number
  pickupRadiusKm?: 1 | 2 | 3
  /** Approximate coordinate ratio for layout (default assumes horizontal route) */
  layout?: 'horizontal' | 'vertical' | 'auto'
  /** Optional mock coordinate data for demo purposes */
  mockCoordinates?: {
    origin: { x: number; y: number }
    destination: { x: number; y: number }
    waypoints: Array<{ id: string; x: number; y: number }>
  }
  className?: string
  /** Whether to animate the path drawing on mount */
  animate?: boolean
}

/**
 * SVG Route Map — animated polyline between origin, waypoints, and destination.
 * Uses a simple proportional layout based on km_from_origin for realistic spacing.
 * Falls back to mock coordinates if provided, otherwise computes linear layout.
 */
export function SVGRouteMap({
  origin,
  destination,
  waypoints,
  totalKm,
  pickupRadiusKm = 2,
  layout = 'auto',
  mockCoordinates,
  className,
  animate = true,
}: SVGRouteMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [pathLength, setPathLength] = useState(0)

  // Handle resize for responsive SVG
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width, height })
      }
    })

    if (svgRef.current) {
      resizeObserver.observe(svgRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  // Compute layout positions
  const stops = useMemo(() => {
    const sortedWaypoints = [...waypoints].sort((a, b) => a.sort_order - b.sort_order)

    if (mockCoordinates) {
      return {
        origin: mockCoordinates.origin,
        destination: mockCoordinates.destination,
        waypoints: sortedWaypoints.map((wp, i) => ({
          ...wp,
          x: mockCoordinates.waypoints[i]?.x ?? 0,
          y: mockCoordinates.waypoints[i]?.y ?? 0,
        })),
      }
    }

    // Auto layout: distribute along a horizontal line with slight curves
    const padding = 40
    const availableWidth = Math.max(300, dimensions.width - padding * 2)
    const availableHeight = Math.max(120, dimensions.height - padding * 2)

    const origin = { x: padding, y: dimensions.height / 2 || 80 }
    const destination = { x: padding + availableWidth, y: dimensions.height / 2 || 80 }

    const waypointPositions = sortedWaypoints.map((wp) => {
      const progress = totalKm > 0 ? wp.km_from_origin / totalKm : 0
      const x = origin.x + progress * (destination.x - origin.x)
      // Add slight vertical variation for visual interest
      const yVariation = Math.sin(progress * Math.PI * 2) * 15
      const y = origin.y + yVariation
      return { ...wp, x, y }
    })

    return { origin, destination, waypoints: waypointPositions }
  }, [waypoints, totalKm, dimensions, mockCoordinates])

  // Generate SVG path
  const pathData = useMemo(() => {
    const points = [
      stops.origin,
      ...stops.waypoints,
      stops.destination,
    ]

    if (points.length < 2) return ''

    // Create smooth curve using quadratic bezier
    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const midX = (prev.x + curr.x) / 2
      const midY = (prev.y + curr.y) / 2

      if (i === 1) {
        path += ` Q ${midX} ${midY} ${curr.x} ${curr.y}`
      } else {
        const prevMidX = (points[i - 2].x + prev.x) / 2
        const prevMidY = (points[i - 2].y + prev.y) / 2
        path += ` T ${curr.x} ${curr.y}`
      }
    }

    return path
  }, [stops])

  // Measure path length for animation
  useEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength()
      setPathLength(length)
    }
  }, [pathData, dimensions])

  // Animate path drawing
  useEffect(() => {
    if (!animate || !pathRef.current || pathLength === 0) return

    const path = pathRef.current
    path.style.strokeDasharray = `${pathLength}`
    path.style.strokeDashoffset = `${pathLength}`
    path.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)'

    // Trigger animation
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0'
    })
  }, [animate, pathLength])

  // Radius circle size in pixels (approximate)
  const radiusPixels = pickupRadiusKm * 8

  return (
    <div className={cn('relative w-full', className)}>
      {/* Dark map card (mockup: charcoal panel, glowing green route) */}
      <div className="overflow-hidden rounded-3xl bg-nav p-4 shadow-card">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${Math.max(400, dimensions.width || 400)} ${Math.max(160, dimensions.height || 160)}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto max-h-64"
          role="img"
          aria-label={`Route from ${origin} to ${destination}`}
        >
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent-from)" />
              <stop offset="100%" stopColor="var(--accent-to)" />
            </linearGradient>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="var(--brand)" />
            </marker>
          </defs>

          {/* Pickup radius circles around waypoints */}
          {stops.waypoints.map((wp) => (
            <circle
              key={wp.id}
              cx={wp.x}
              cy={wp.y}
              r={radiusPixels}
              fill="var(--brand-soft)"
              stroke="var(--brand)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity={0.35}
              className="transition-opacity hover:opacity-70"
            />
          ))}

          {/* Route path */}
          <path
            ref={pathRef}
            d={pathData}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd="url(#arrowhead)"
            className="drop-shadow-[0_2px_8px_rgba(155,233,107,0.45)]"
          />

          {/* Origin marker */}
          <g transform={`translate(${stops.origin.x}, ${stops.origin.y})`}>
            <circle
              cx="0"
              cy="0"
              r="12"
              fill="#2a2d33"
              stroke="#9a9ca2"
              strokeWidth="2.5"
            />
          </g>

          {/* Waypoint markers */}
          {stops.waypoints.map((wp) => (
            <g key={wp.id} transform={`translate(${wp.x}, ${wp.y})`}>
              <circle
                cx="0"
                cy="0"
                r="10"
                fill="#1d1f23"
                stroke="var(--brand)"
                strokeWidth="2.5"
              />
              <circle cx="0" cy="0" r="3" fill="var(--brand)" />
              <text
                x="0"
                y="-16"
                textAnchor="middle"
                fill="#9a9ca2"
                className="text-[10px] font-medium whitespace-nowrap"
                style={{ fontFamily: 'inherit' }}
              >
                {wp.label}
              </text>
            </g>
          ))}

          {/* Destination marker — the glowing green pin */}
          <g transform={`translate(${stops.destination.x}, ${stops.destination.y})`}>
            <circle
              cx="0"
              cy="0"
              r="14"
              fill="var(--brand)"
              className="drop-shadow-[0_0_10px_rgba(155,233,107,0.8)]"
            />
            <circle cx="0" cy="0" r="4.5" fill="var(--brand-ink)" />
          </g>
        </svg>
      </div>

      {/* Legend / Labels below */}
      <div className="mt-4 flex flex-col gap-2 text-xs text-ink-secondary">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-brand" />
          <span className="font-medium text-ink">{origin}</span>
        </div>
        {stops.waypoints.map((wp) => (
          <div key={wp.id} className="flex items-center gap-2 pl-6">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-brand bg-elevated" />
            <span className="font-medium text-ink">{wp.label}</span>
            <Badge variant="brand" size="sm" className="ml-1">
              {wp.km_from_origin} km
            </Badge>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-ok" />
          <span className="font-medium text-ink">{destination}</span>
          <Badge variant="success" size="sm" className="ml-1">
            {Math.round(totalKm)} km total
          </Badge>
        </div>
      </div>
    </div>
  )
}
