import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Car, Mail, MapPin, Phone, Shield, Users, CheckCircle2, Clock } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProfileSignOut } from '@/components/profile/ProfileSignOut'
import { cn } from '@/lib/utils'

export const revalidate = 60
export const metadata = { title: 'Profile' }

interface ProfileData {
  id: string
  full_name: string | null
  email: string
  gender: string | null
  phone: string | null
  city: string | null
  avatar_url: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  vehicle_plate: string | null
  email_verified: boolean
  phone_verified: boolean
  created_at: string
}

async function getProfile(userId: string) {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data as ProfileData | null
}

async function getHostedCount(userId: string) {
  const supabase = createClient()
  const { count } = await supabase.from('travels').select('*', { count: 'exact', head: true }).eq('host_id', userId)
  return count ?? 0
}

async function getJoinedCount(userId: string) {
  const supabase = createClient()
  const { count } = await supabase.from('travel_members').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_host', false)
  return count ?? 0
}

export default async function ProfilePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div className="flex min-h-dvh items-center justify-center">Not logged in</div>
  }

  const [profile, hostedCount, joinedCount] = await Promise.all([
    getProfile(user.id),
    getHostedCount(user.id),
    getJoinedCount(user.id),
  ])

  const genderBadgeVariant = {
    male: 'brand',
    female: 'warning',
  }[profile?.gender ?? 'male'] as 'brand' | 'warning'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Profile</h1>
        <Link href="/profile/edit">
          <Button variant="outline" size="sm" className="gap-2">
            Edit
            <Car className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-card p-8 shadow-soft text-center">
        <Avatar name={profile?.full_name ?? 'User'} src={profile?.avatar_url} size="xl" />
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">{profile?.full_name ?? 'User'}</h2>
          <p className="text-sm text-ink-secondary">{profile?.email ?? 'No email'}</p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant={genderBadgeVariant} size="sm" className="gap-1">
            {profile?.gender === 'male' ? '🚹' : '🚺'} {(profile?.gender ?? 'Male').charAt(0).toUpperCase() + (profile?.gender ?? 'Male').slice(1)}
          </Badge>
          {profile?.city && (
            <Badge variant="outline" size="sm" className="gap-1">
              <MapPin className="h-3 w-3" /> {profile.city}
            </Badge>
          )}
          <Badge variant={profile?.email_verified ? 'success' : 'outline'} size="sm" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> {profile?.email_verified ? 'Verified' : 'Unverified'}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Link href="/host" className="rounded-3xl bg-card p-6 shadow-soft transition-colors hover:shadow-card text-center">
          <Users className="h-8 w-8 mx-auto text-brand mb-2" />
          <p className="text-3xl font-bold text-ink">{hostedCount}</p>
          <p className="text-sm text-ink-secondary">Rides Hosted</p>
        </Link>
        <Link href="/feed" className="rounded-3xl bg-card p-6 shadow-soft transition-colors hover:shadow-card text-center">
          <Clock className="h-8 w-8 mx-auto text-brand mb-2" />
          <p className="text-3xl font-bold text-ink">{joinedCount}</p>
          <p className="text-sm text-ink-secondary">Rides Joined</p>
        </Link>
      </div>

      {/* Vehicle Card */}
      <div className="mt-6 rounded-3xl bg-card p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <Car className="h-5 w-5 text-brand" />
          Vehicle
        </h3>
        {profile?.vehicle_make || profile?.vehicle_model || profile?.vehicle_color || profile?.vehicle_plate ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="text-ink-secondary shrink-0 w-24">Make</span>
              <span className="font-medium text-ink">{profile.vehicle_make ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-secondary shrink-0 w-24">Model</span>
              <span className="font-medium text-ink">{profile.vehicle_model ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-secondary shrink-0 w-24">Color</span>
              <span className="font-medium text-ink">{profile.vehicle_color ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-secondary shrink-0 w-24">Plate</span>
              <span className="font-medium text-ink tabular">{profile.vehicle_plate ?? '—'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <Car className="h-10 w-10 text-ink-tertiary" />
            <p className="text-ink-secondary">No vehicle added</p>
            <Link href="/profile/edit#vehicle">
              <Button variant="primary" size="sm" className="gap-2">
                Add Vehicle
                <Car className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Phone */}
      <div className="mt-6 rounded-3xl bg-card p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5 text-brand" />
          Phone
        </h3>
        {profile?.phone ? (
          <p className="font-medium text-ink tabular">{profile.phone}</p>
        ) : (
          <Link href="/profile/edit">
            <Button variant="outline" size="sm" className="gap-2">
              Add Phone
              <Phone className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Sign out — lives here on mobile (bottom nav has 4 clean tabs) */}
      <div className="mt-8">
        <ProfileSignOut />
      </div>

      {/* Footer Links */}
      <div className="mt-4 flex flex-col items-center gap-3 text-xs text-ink-tertiary">
        <Link href="/legal/tos" className="hover:underline">Terms of Service</Link>
        <Link href="/legal/privacy" className="hover:underline">Privacy Policy</Link>
      </div>
    </div>
  )
}