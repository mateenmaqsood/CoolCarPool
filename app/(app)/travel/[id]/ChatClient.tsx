'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Send,
  ChevronLeft,
  Phone,
  MoreVertical,
  Check,
  X,
  Shield,
  UserPlus,
  Lock,
  MessageSquare,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { subscribeToTravelMessages, unsubscribe, type Message } from '@/lib/realtime'
import { createClient } from '@/lib/supabase/client'
import type { Travel, Profile } from '@/types'
import { cn, formatDeparture, timeUntil, initials } from '@/lib/utils'

interface ChatClientProps {
  travel: Travel & { host?: Profile | null }
  members: Array<{ user_id: string; is_host: boolean; is_full_route: boolean; km_from_origin: number; profile?: Profile | null }>
  messages: Array<Message & { sender?: Profile | null }>
  currentUserId: string | null
  isHost: boolean
}

export function ChatClient({ travel, members, messages, currentUserId, isHost }: ChatClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const isMember = currentUserId ? members.some(m => m.user_id === currentUserId && !m.is_host) : false

  const [localMessages, setLocalMessages] = useState(messages)
  const [newMessage, setNewMessage] = useState('')
  const [showMemberList, setShowMemberList] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = subscribeToTravelMessages(travel.id, {
      onInsert: (msg) => {
        setLocalMessages((prev) => {
          // Avoid duplicates from optimistic update
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      },
    })
    return () => unsubscribe(channel)
  }, [travel.id])

  const isCurrentUserHost = isHost
  const host = travel.host ?? { id: travel.host_id, full_name: 'Host', avatar_url: null, gender: 'male' as const }

  // Get member profiles for display
  const memberProfiles = members.map((m) => m.profile).filter(Boolean) as Profile[]

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const content = newMessage.trim()
    setNewMessage('')
    const tempId = `temp-${Date.now()}`
    const myProfile = members.find(m => m.user_id === user.id)?.profile ?? null
    setLocalMessages(prev => [...prev, {
      id: tempId, travel_id: travel.id, sender_id: user.id,
      content, is_system: false, created_at: new Date().toISOString(), sender: myProfile
    }])

    const { data, error } = await supabase.from('messages')
      .insert({ travel_id: travel.id, sender_id: user.id, content })
      .select('id, created_at').single()

    if (error) {
      setLocalMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(content)
      toast({ title: error.code === '42501' ? 'Only accepted members can chat' : 'Message failed', description: error.message, variant: 'error' })
      return
    }
    setLocalMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, created_at: data.created_at } : m))
  }

  const handleLeaveTravel = async () => {
    if (!currentUserId) return
    setLeaving(true)
    try {
      const { error } = await supabase.from('travel_members').delete().eq('travel_id', travel.id).eq('user_id', currentUserId)
      if (error) throw error
      toast({ title: 'Left the travel', variant: 'success' })
      router.push('/feed')
      router.refresh()
    } catch (error) {
      console.error('[leave] error:', error)
      toast({ title: 'Failed to leave', variant: 'error' })
    } finally {
      setLeaving(false)
      setShowLeaveConfirm(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const getMessageType = (msg: Message & { sender?: Profile | null }) => {
    if (msg.is_system) return 'system'
    if (msg.sender_id === currentUserId) return 'self'
    return 'other'
  }

  const isPhoneVisible = (memberId: string) => {
    // Phone visible only if member is accepted (not pending request)
    const member = members.find((m) => m.user_id === memberId)
    return member && !member.is_host && member.is_full_route !== false // accepted members
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] max-h-[80vh] bg-card rounded-3xl shadow-soft overflow-hidden flex-1">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-line bg-elevated px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/travel/${travel.id}`} className="p-1 rounded-lg text-ink-tertiary hover:bg-elevated transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="font-semibold text-ink truncate max-w-xs">
              {travel.origin_text} → {travel.destination_text}
            </p>
            <p className="text-xs text-ink-secondary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {members.filter((m) => !m.is_host).length} riders · {timeUntil(travel.departure_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowMemberList(true)} aria-label="Members">
            <UserPlus className="h-5 w-5" />
          </Button>
          {isCurrentUserHost && (
            <Button variant="ghost" size="icon" onClick={() => router.push(`/travel/${travel.id}/bill`)} aria-label="Bill">
              <MessageSquare className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowLeaveConfirm(true)} aria-label="Leave travel">
            <Lock className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
        {localMessages.map((msg, idx) => {
          const type = getMessageType(msg)
          const isFirstOfGroup = idx === 0 || getMessageType(localMessages[idx - 1]) !== type
          const sender = msg.sender ?? (msg.sender_id ? members.find((m) => m.user_id === msg.sender_id)?.profile : null)

          return (
            <div key={msg.id} className={cn('flex gap-2', type === 'self' && 'flex-row-reverse')}>
              {type !== 'self' && type !== 'system' && (
                <Avatar
                  name={sender?.full_name ?? 'Unknown'}
                  src={sender?.avatar_url}
                  size="sm"
                  className="shrink-0 mt-1"
                />
              )}

              <div className={cn('max-w-[70%] flex flex-col', type === 'self' && 'items-end')}>
                {isFirstOfGroup && type !== 'system' && sender && (
                  <p className="text-xs text-ink-tertiary mb-0.5 pl-1">
                    {sender.full_name} {msg.sender_id === travel.host_id && <Badge variant="brand" size="sm">Host</Badge>}
                  </p>
                )}

                <div
                  className={cn(
                    'rounded-2xl px-4 py-2 text-sm leading-relaxed',
                    type === 'self'
                      ? 'bg-brand text-brand-ink rounded-br-md'
                      : type === 'system'
                      ? 'bg-sunken text-center text-ink-secondary italic px-3 py-1 text-xs'
                      : 'bg-elevated text-ink rounded-bl-md shadow-sm'
                  )}
                >
                  {msg.content}
                </div>

                <p className="text-[10px] text-ink-tertiary mt-0.5 pl-1">{formatTime(msg.created_at)}</p>
              </div>

              {type === 'self' && (
                <Avatar name="You" size="sm" className="shrink-0 mt-1" />
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      {(isMember || isHost) ? (
        <div className="border-t border-line bg-elevated px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 min-h-[44px] max-h-[120px] rounded-xl bg-card px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-soft resize-none"
              aria-label="Message"
              style={{ overflow: 'hidden' }}
            />
            <Button
              variant="primary"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="h-10 shrink-0"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-elevated p-4 text-sm text-ink-secondary border-t border-line">
          <Shield className="h-4 w-4" />
          Chat unlocks once the host accepts your request.
        </div>
      )}

      {/* Member List Modal */}
      <Dialog open={showMemberList} onOpenChange={setShowMemberList}>
        <DialogContent title="Riders" description={`${members.filter((m) => !m.is_host).length} passengers`}>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {members.map((m) => {
              const profile = m.profile
              const name = profile?.full_name ?? 'Passenger'
              const isHostMember = m.is_host
              const isCurrentUser = m.user_id === currentUserId

              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-3 rounded-xl border border-line bg-sunken"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={name} src={profile?.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink truncate">{name}</p>
                        {isHostMember && <Badge variant="brand" size="sm">Host</Badge>}
                        {isCurrentUser && <Badge variant="outline" size="sm">You</Badge>}
                      </div>
                      <p className="text-xs text-ink-secondary">
                        {m.is_full_route
                          ? 'Full route'
                          : `Mid-route · ${m.km_from_origin} km`}
                      </p>
                    </div>
                  </div>
                  {isPhoneVisible(m.user_id) && profile?.phone && (
                    <Button variant="ghost" size="icon" aria-label={`Call ${name}`}>
            <Phone className="h-5 w-5" />
          </Button>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Confirm Dialog */}
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent title="Leave Travel" description="Are you sure you want to leave this travel? You can re-request later if seats are available.">
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)} className="flex-1">
              Stay
            </Button>
            <Button variant="danger" onClick={handleLeaveTravel} loading={leaving} className="flex-1">
              <Lock className="h-4 w-4 mr-2" />
              Leave Travel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}