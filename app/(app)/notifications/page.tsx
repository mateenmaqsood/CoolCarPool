'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, BellOff, CheckCircle2, X, Shield, UserPlus, Lock, MessageSquare, Truck } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { cn, timeUntil } from '@/lib/utils'

interface Notification {
  id: string
  user_id: string
  type: string
  travel_id: string | null
  payload: unknown
  read: boolean
  created_at: string
}

function getNotificationContent(n: Notification): { title: string; body: string; icon: React.ReactNode } {
  const p = (n.payload ?? {}) as Record<string, unknown>
  switch (n.type) {
    case 'request_received':
      return {
        title: 'New ride request',
        body: `${p.requester_name ?? 'Someone'} wants to join ${p.travel_origin ?? 'your ride'}`,
        icon: <Bell className="h-5 w-5 text-brand" />
      }
    case 'request_accepted':
      return {
        title: 'Request accepted! 🎉',
        body: `Your request for ${p.travel_origin ?? 'the ride'} was accepted`,
        icon: <CheckCircle2 className="h-5 w-5 text-[var(--ok)]" />
      }
    case 'request_rejected':
      return {
        title: 'Request declined',
        body: `Your request for ${p.travel_origin ?? 'the ride'} was declined`,
        icon: <X className="h-5 w-5 text-[var(--error)]" />
      }
    case 'travel_locked':
      return {
        title: 'Travel locked',
        body: `${p.travel_origin ?? 'Your ride'} is now locked — no more requests accepted`,
        icon: <Lock className="h-5 w-5 text-warn" />
      }
    case 'travel_cancelled':
      return {
        title: 'Ride cancelled',
        body: `${p.travel_origin ?? 'Your ride'} → ${p.travel_destination ?? 'destination'} was cancelled by the host`,
        icon: <Truck className="h-5 w-5 text-[var(--error)]" />
      }
    case 'bill_uploaded':
      return {
        title: 'Receipt uploaded',
        body: `Host uploaded a receipt for ${p.travel_origin ?? 'your ride'}`,
        icon: <Truck className="h-5 w-5 text-warn" />
      }
    case 'chat_message':
      return {
        title: 'New message',
        body: `${p.sender_name ?? 'Someone'}: ${String(p.message_preview ?? '').slice(0, 50)}`,
        icon: <MessageSquare className="h-5 w-5 text-brand" />
      }
    default:
      return {
        title: 'Notification',
        body: 'You have a new update',
        icon: <Bell className="h-5 w-5 text-ink-tertiary" />
      }
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!cancelled && data) {
        setNotifications(data)
        // Mark all as read on page load
        const unreadIds = data.filter(n => !n.read).map(n => n.id)
        if (unreadIds.length > 0) {
          await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
        }
      }
      if (!cancelled) setLoading(false)
    })()

    // BUG 2: live updates — new notifications appear without a refresh.
    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      channel = supabase
        .channel(`notifications-page-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as Notification | null
            if (!row) return
            setNotifications((prev) => [row, ...prev])
            // It lands unread; mark it read so the count stays honest.
            void supabase.from('notifications').update({ read: true }).eq('id', row.id)
          },
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase])

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-sunken" />
          ))}
        </div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Notifications</h1>
          <p className="text-sm text-ink-secondary">{notifications.length} total · {unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            toast({ title: 'All marked as read', variant: 'success' })
          }}>
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-card p-12 text-center">
          <BellOff className="h-12 w-12 text-ink-tertiary" />
          <p className="font-medium text-ink">No notifications yet</p>
          <p className="max-w-xs text-sm text-ink-secondary">
            When you get ride requests, chat messages, or bill updates, they will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" role="list" aria-label="Notifications">
          {notifications.map((n) => {
            const { title, body, icon } = getNotificationContent(n)
            return (
              <li key={n.id} className={cn(
                'flex items-start gap-3 p-4 rounded-2xl transition-colors',
                n.read ? 'bg-card' : 'bg-elevated ring-1 ring-brand'
              )}>
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium text-ink', !n.read && 'font-semibold')}>
                    {title}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-secondary truncate">{body}</p>
                  <p className="mt-1 text-xs text-ink-tertiary">{formatTime(n.created_at)}</p>
                </div>
                {!n.read && (
                  <Badge variant="brand" size="sm">New</Badge>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-8 text-center">
        <Link href="/feed" className="inline-flex items-center gap-2 text-brand hover:underline">
          <Truck className="h-4 w-4" />
          Back to Feed
        </Link>
      </div>
    </div>
  )
}

function formatTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
}