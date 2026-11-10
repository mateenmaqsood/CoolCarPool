'use client'

import { useState } from 'react'
import { Download, CheckCircle2, Clock, AlertTriangle, XCircle, Wallet, MapPin, UserCheck, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { cn, formatPKR, formatDeparture } from '@/lib/utils'
import type { BillSlip, BillMemberFareRow, Profile } from '@/types'

export interface CostBreakdownProps {
  billSlip: BillSlip
  travel: {
    id: string
    origin_text: string
    destination_text: string
    departure_at: string
    total_km: number
  }
  members: Array<{
    user_id: string
    is_host: boolean
    is_full_route: boolean
    km_from_origin: number
    profile?: Profile | null
  }>
  currentUserId: string | null
  isHost: boolean
  className?: string
}

interface MemberRow extends BillMemberFareRow {
  profile?: Profile | null
  hasAcknowledged: boolean
  isCurrentUser: boolean
}

export function CostBreakdown({
  billSlip,
  travel,
  members,
  currentUserId,
  isHost,
  className,
}: CostBreakdownProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [showExport, setShowExport] = useState(false)

  const breakdown = billSlip.breakdown
  const memberRows = (breakdown.members ?? []).map((row) => {
    const member = members.find((m) => m.user_id === row.userId)
    return {
      ...row,
      profile: member?.profile ?? null,
      hasAcknowledged: billSlip.acknowledged_by.includes(row.userId),
      isCurrentUser: row.userId === currentUserId,
    }
  })

  const totalAllocated = breakdown.total_allocated_pkr ?? 0
  const rounding = breakdown.rounding_pkr ?? 0

  const handleAcknowledge = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('bill_slips')
        .update({
          acknowledged_by: [...billSlip.acknowledged_by, userId],
        })
        .eq('id', billSlip.id)

      if (error) throw error

      toast({ title: 'Marked as paid', variant: 'success' })
      // In real app, would refetch or use realtime
    } catch (error) {
      console.error('[acknowledge] error:', error)
      toast({ title: 'Failed to acknowledge', variant: 'error' })
    }
  }

  const handleExport = async () => {
    // For now, just copy to clipboard as JSON
    const exportData = {
      travel: `${travel.origin_text} → ${travel.destination_text}`,
      date: formatDeparture(travel.departure_at),
      total_km: travel.total_km,
      total_bill: billSlip.total_pkr,
      per_km_rate: breakdown.per_km_rate_pkr,
      members: memberRows.map((m) => ({
        name: m.fullName,
        type: m.isHost ? 'Host' : m.isFullRoute ? 'Full route' : 'Mid-route',
        km_covered: m.kmCovered,
        fare: m.farePkr,
        share: `${m.sharePercentage}%`,
        acknowledged: m.hasAcknowledged,
      })),
      generated_at: new Date().toISOString(),
    }

    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
    toast({ title: 'Receipt data copied!', description: 'Paste into a spreadsheet or document.', variant: 'success' })
  }

  const getStatusBadge = (row: MemberRow) => {
    if (row.hasAcknowledged) {
      return <Badge variant="success" size="sm" icon={<CheckCircle2 className="h-3 w-3" />}>Paid</Badge>
    }
    if (row.isCurrentUser) {
      return <Badge variant="warning" size="sm" icon={<Clock className="h-3 w-3" />}>Pending</Badge>
    }
    return <Badge variant="outline" size="sm">Unpaid</Badge>
  }

  const getMemberBadge = (row: MemberRow) => {
    if (row.isHost) return <Badge variant="brand" size="sm"><Wallet className="h-3 w-3 mr-1" />Host</Badge>
    if (row.isFullRoute) return <Badge variant="success" size="sm"><MapPin className="h-3 w-3 mr-1" />Full route</Badge>
    return <Badge variant="warning" size="sm"><MapPin className="h-3 w-3 mr-1" />Mid-route</Badge>
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* Receipt Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-6 w-6 text-brand" />
                Trip Receipt
              </CardTitle>
              <p className="text-sm text-ink-secondary mt-1">
                {travel.origin_text} → {travel.destination_text} · {formatDeparture(travel.departure_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={billSlip.breakdown.ocr_source === 'anthropic' ? 'brand' : 'warning'} size="sm">
                {billSlip.breakdown.ocr_source === 'anthropic' ? 'AI Extracted' : 'Manual Entry'}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Summary Row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Total Bill" value={formatPKR(billSlip.total_pkr ?? 0)} icon={<Wallet className="h-5 w-5" />} color="brand" />
            <SummaryCard
              label="Per-KM Rate"
              value={breakdown.per_km_rate_pkr ? `${breakdown.per_km_rate_pkr.toFixed(2)} PKR/km` : '—'}
              icon={<MapPin className="h-5 w-5" />}
              color="success"
            />
            <SummaryCard
              label="Mid-Route Total"
              value={formatPKR(breakdown.mid_route_total_pkr ?? 0)}
              icon={<UserCheck className="h-5 w-5" />}
              color="warning"
            />
            <SummaryCard
              label="Full-Route Each"
              value={formatPKR(breakdown.full_route_fare_head_pkr ?? 0)}
              icon={<CreditCard className="h-5 w-5" />}
              color="brand"
            />
          </div>

          {/* Member Breakdown Table */}
          <div className="rounded-xl border border-line bg-sunken overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-elevated/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">Member</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">Type</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">KM</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">Fare</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">Share</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-secondary">Status</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {memberRows.map((row) => (
                  <tr key={row.userId} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={row.fullName}
                          src={row.profile?.avatar_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{row.fullName}</p>
                          {row.profile?.phone && (
                            <p className="text-xs text-ink-tertiary">{row.profile.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{getMemberBadge(row)}</td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-ink">{row.kmCovered} km</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{formatPKR(row.farePkr)}</td>
                    <td className="px-4 py-3 text-center text-sm text-ink-secondary">{row.sharePercentage}%</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(row)}</td>
                    <td className="px-4 py-3 text-right">
                      {row.isCurrentUser && !row.hasAcknowledged ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAcknowledge(row.userId)}
                          className="h-8 px-3"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                        </Button>
                      ) : row.hasAcknowledged ? (
                        <span className="flex items-center justify-end gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                        </span>
                      ) : (
                        <span className="text-xs text-ink-tertiary">Waiting...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Rounding */}
          <div className="flex items-center justify-between pt-3 border-t border-line">
            <div className="text-sm text-ink-secondary">
              Total allocated: <span className="font-semibold text-ink">{formatPKR(totalAllocated)}</span>
            </div>
            {rounding !== 0 && (
              <div className="flex items-center gap-1.5 text-sm text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Rounding difference: {formatPKR(Math.abs(rounding))} {rounding > 0 ? '(under)' : '(over)'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settlement Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-500" />
            Settlement Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-secondary">Acknowledged</span>
              <span className="font-medium text-ink">
                {billSlip.acknowledged_by.length} / {memberRows.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-sunken overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.round((billSlip.acknowledged_by.length / memberRows.length) * 100)}%` }}
              />
            </div>
            {billSlip.acknowledged_by.length === memberRows.length && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                All members have acknowledged payment!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'brand' | 'success' | 'warning'
}) {
  const colorClasses = {
    brand: 'bg-brand-soft text-brand border-brand/20',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}