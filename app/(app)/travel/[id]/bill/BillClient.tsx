'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, FileText, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { SlipUploader } from '@/components/cost/SlipUploader'
import { CostBreakdown } from '@/components/cost/CostBreakdown'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { notifyUsers } from '@/lib/notify'
import type { Travel, BillSlip, Profile } from '@/types'
import { cn, formatDeparture, timeUntil } from '@/lib/utils'

interface BillClientProps {
  travel: Travel
  billSlip: BillSlip | null
  members: Array<{
    user_id: string
    is_host: boolean
    is_full_route: boolean
    km_from_origin: number
    profile?: Profile | null
  }>
  currentUserId: string | null
  isHost: boolean
  isMember: boolean
}

export function BillClient({
  travel,
  billSlip,
  members,
  currentUserId,
  isHost,
  isMember,
}: BillClientProps) {
  const { toast } = useToast()
  const supabase = createClient()

  const [uploading, setUploading] = useState(false)
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)

  const handleUploadComplete = async (totalPkr: number) => {
    if (!currentUserId) {
      toast({ title: 'Please log in first', variant: 'error' })
      return
    }
    setUploading(true)
    try {
      // In a real app, you'd first upload the file to storage, then create bill_slip record
      // For demo, we'll simulate the bill creation
      const { data, error } = await supabase
        .from('bill_slips')
        .insert({
          travel_id: travel.id,
          uploaded_by: currentUserId,
          storage_path: `bill-slips/${travel.id}/demo-receipt.jpeg`,
          total_pkr: totalPkr,
          total_km: travel.total_km,
          breakdown: {
            ocr_source: 'manual',
          },
          acknowledged_by: currentUserId ? [currentUserId] : [],
        })
        .select()
        .single()

      if (error) throw error

      toast({ title: 'Receipt saved!', variant: 'success' })
      setShowUploadSuccess(true)

      // Notify every member that the receipt is up (fire-and-forget).
      const otherIds = members.filter(m => m.user_id !== currentUserId).map(m => m.user_id)
      void notifyUsers(otherIds, {
        type: 'bill_uploaded',
        travelId: travel.id,
        payload: {
          travel_origin: travel.origin_text,
          travel_destination: travel.destination_text,
        },
      })
      // In real app, would redirect or refresh
    } catch (error) {
      console.error('[bill] save error:', error)
      toast({ title: 'Failed to save receipt', variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const handleUploadNew = async () => {
    // Reset to upload mode
    setShowUploadSuccess(false)
  }

  const isCurrentUserHost = isHost

  if (!billSlip) {
    // No bill slip yet - show uploader
    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/travel/${travel.id}`} className="mb-4 inline-flex items-center gap-2 text-ink-tertiary hover:text-ink">
              <ChevronLeft className="h-5 w-5" />
              Back to travel
            </Link>
            <div className="flex items-center gap-2 text-sm text-ink-secondary mb-2">
              <span className="font-medium text-ink truncate max-w-xs">
                {travel.origin_text} → {travel.destination_text}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Upload Receipt</h1>
            <p className="text-sm text-ink-secondary mt-1">
              {formatDeparture(travel.departure_at)} · {timeUntil(travel.departure_at)} · {travel.total_km} km
            </p>
          </div>
          {isCurrentUserHost && (
            <Badge variant="brand" size="sm">Host</Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-brand" />
              Fuel / Toll Receipt
            </CardTitle>
            <p className="text-sm text-ink-secondary">
              Upload a photo of the fuel/toll receipt. AI will extract the total amount in PKR.
              If AI can't read it, you can enter the amount manually.
            </p>
          </CardHeader>
          <CardContent>
            <SlipUploader
              travelId={travel.id}
              onUploadComplete={handleUploadComplete}
            />
          </CardContent>
        </Card>

        {!isCurrentUserHost && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-ink">Only the host can upload receipts</p>
                  <p className="text-sm text-ink-secondary mt-1">
                    Ask the host to upload the fuel/toll receipt. Once uploaded, you'll see the itemized cost breakdown here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Bill slip exists - show breakdown
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href={`/travel/${travel.id}`} className="mb-4 inline-flex items-center gap-2 text-ink-tertiary hover:text-ink">
            <ChevronLeft className="h-5 w-5" />
            Back to travel
          </Link>
          <div className="flex items-center gap-2 text-sm text-ink-secondary mb-2">
            <span className="font-medium text-ink truncate max-w-xs">
              {travel.origin_text} → {travel.destination_text}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Trip Receipt</h1>
            <Badge variant={billSlip.breakdown.ocr_source === 'anthropic' ? 'brand' : 'warning'} size="sm">
              {billSlip.breakdown.ocr_source === 'anthropic' ? 'AI Extracted' : 'Manual Entry'}
            </Badge>
            {isCurrentUserHost && (
              <Badge variant="brand" size="sm">Host</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCurrentUserHost && (
            <Button variant="outline" onClick={handleUploadNew} className="h-9">
              <RefreshCw className="h-4 w-4 mr-2" /> Upload New
            </Button>
          )}
        </div>
      </div>

      {/* Cost Breakdown */}
      <CostBreakdown
        billSlip={billSlip}
        travel={{
          id: travel.id,
          origin_text: travel.origin_text,
          destination_text: travel.destination_text,
          departure_at: travel.departure_at,
          total_km: travel.total_km,
        }}
        members={members}
        currentUserId={currentUserId}
        isHost={isHost}
      />

      {/* Receipt Image */}
      {billSlip.storage_path && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand" />
              Receipt Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-line bg-sunken overflow-hidden max-w-md">
              <img
                src={`/api/storage/bill-slips/${billSlip.storage_path}`}
                alt="Receipt"
                className="w-full h-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="p-4 text-center text-sm text-ink-secondary">
                Tap to view full size
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}