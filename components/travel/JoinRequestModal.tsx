'use client'

import { useState } from 'react'
import { MapPin, User, X, Send } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { cn, formatPKR, formatDeparture } from '@/lib/utils'
import type { Travel, Waypoint } from '@/types'

export interface JoinRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  travel: Travel
  waypoints: Waypoint[]
  onSubmit: (waypointId: string | null, kmToOrigin: number | null, message: string, seatsRequested?: number) => void
  pending?: boolean
}

/**
 * Modal for passengers to request joining a travel.
 * Allows choosing between full-route, mid-route (waypoint) join, or a
 * sub-portion (mid-route pickup + mid-route drop-off).
 */
export function JoinRequestModal({
  open,
  onOpenChange,
  travel,
  waypoints,
  onSubmit,
  pending = false,
}: JoinRequestModalProps) {
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null)
  const [kmTo, setKmTo] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const handleSubmit = () => {
    onSubmit(selectedWaypointId, kmTo, message)
    onOpenChange(false)
    setSelectedWaypointId(null)
    setKmTo(null)
    setMessage('')
  }

  const fullRouteLabel = `${travel.origin_text} → ${travel.destination_text}`
  const fullRouteKm = Math.round(travel.total_km)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Request Seat"
        description={`${fullRouteLabel} · ${formatDeparture(travel.departure_at)} · ${formatPKR(travel.estimated_cost_pkr ?? 0)}`}
        showClose
      >
        <div className="space-y-5">
          {/* Route summary */}
          <div className="rounded-xl border border-line bg-sunken p-4">
            <div className="flex items-center gap-2 text-sm text-ink-secondary mb-2">
              <MapPin className="h-4 w-4 text-brand" />
              <span>{fullRouteLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-secondary">Departure</span>
              <span className="font-medium text-ink">{formatDeparture(travel.departure_at)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-ink-secondary">Est. cost</span>
              <span className="font-semibold text-ink">{formatPKR(travel.estimated_cost_pkr ?? 0)}</span>
            </div>
          </div>

          {/* Join type selection */}
          <fieldset>
            <legend className="text-sm font-medium text-ink mb-3">How would you like to join?</legend>
            <div className="space-y-2">
              {/* Full route option */}
              <button
                type="button"
                onClick={() => setSelectedWaypointId(null)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                  selectedWaypointId === null
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-elevated hover:border-brand hover:bg-brand-soft/20'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                  selectedWaypointId === null
                    ? 'border-brand bg-brand'
                    : 'border-line bg-transparent'
                )}>
                  {selectedWaypointId === null && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink">Full route</p>
                  <p className="text-xs text-ink-secondary">
                    {fullRouteLabel} · {fullRouteKm} km
                  </p>
                </div>
                <Badge variant={selectedWaypointId === null ? 'brand' : 'outline'} size="sm">
                  Full trip
                </Badge>
              </button>

              {/* Mid-route options */}
              {waypoints.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => setSelectedWaypointId(wp.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    selectedWaypointId === wp.id
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-elevated hover:border-brand hover:bg-brand-soft/20'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                    selectedWaypointId === wp.id
                      ? 'border-brand bg-brand'
                      : 'border-line bg-transparent'
                  )}>
                    {selectedWaypointId === wp.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-brand" />
                      <p className="font-medium text-ink truncate">{wp.label}</p>
                    </div>
                    <p className="text-xs text-ink-secondary">
                      Join at {wp.km_from_origin} km · {Math.round(travel.total_km - wp.km_from_origin)} km ride
                    </p>
                  </div>
                  <Badge variant={selectedWaypointId === wp.id ? 'brand' : 'outline'} size="sm">
                    Mid-route
                  </Badge>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Sub-portion: pick your drop-off when joining mid-route */}
          {selectedWaypointId ? (
            <fieldset>
              <legend className="text-sm font-medium text-ink mb-3">Get off at</legend>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setKmTo(null)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    kmTo === null
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-elevated hover:border-brand'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                    kmTo === null ? 'border-brand bg-brand' : 'border-line bg-transparent'
                  )}>
                    {kmTo === null && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink">Destination — {travel.destination_text}</p>
                    <p className="text-xs text-ink-tertiary">Ride the rest of the route</p>
                  </div>
                </button>
                {waypoints
                  .filter((w) => {
                    const pickupKm = waypoints.find((p) => p.id === selectedWaypointId)?.km_from_origin ?? 0
                    return w.km_from_origin > pickupKm + 1
                  })
                  .map((wp) => (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => setKmTo(wp.km_from_origin)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                        kmTo !== null && Math.abs(kmTo - wp.km_from_origin) < 1
                          ? 'border-brand bg-brand-soft'
                          : 'border-line bg-elevated hover:border-brand'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                        kmTo !== null && Math.abs(kmTo - wp.km_from_origin) < 1
                          ? 'border-brand bg-brand'
                          : 'border-line bg-transparent'
                      )}>
                        {kmTo !== null && Math.abs(kmTo - wp.km_from_origin) < 1 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">{wp.label}</p>
                        <p className="text-xs text-ink-tertiary">Get off at km {Math.round(wp.km_from_origin)}</p>
                      </div>
                    </button>
                  ))}
              </div>
              {/* Live segment estimate for the chosen sub-portion */}
              {(() => {
                const pickupKm = waypoints.find((p) => p.id === selectedWaypointId)?.km_from_origin ?? 0
                const segKm = Math.max(0, Math.round((kmTo ?? travel.total_km) - pickupKm))
                const estShare =
                  travel.total_km > 0
                    ? Math.round((segKm / travel.total_km) * (travel.estimated_cost_pkr ?? 0))
                    : 0
                return (
                  <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-xs text-ink">
                    Your stretch: <strong>{segKm} km</strong> · est. share <strong>{estShare.toLocaleString('en-PK')} PKR</strong>
                  </p>
                )
              })()}
            </fieldset>
          ) : null}

          {/* Message to host */}
          <div>
            <label htmlFor="join-message" className="block text-sm font-medium text-ink mb-1.5">
              Message to host (optional)
            </label>
            <textarea
              id="join-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Hi! I'd like to join your ride. I'll be at the pickup point 10 mins early."
              className="w-full rounded-xl border border-line bg-sunken px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={pending}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1" disabled={pending} loading={pending}>
            <Send className="h-4 w-4 mr-1" /> Send Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}