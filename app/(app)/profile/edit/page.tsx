'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Car, Mail, MapPin, Phone, Upload, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { PK_CITIES } from '@/lib/validations'
import { cn } from '@/lib/utils'

const GENDER_OPTIONS = [
  { value: 'male' as const, label: 'Male' },
  { value: 'female' as const, label: 'Female' },
]

const profileEditSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name').max(80),
  phone: z.string().max(20).regex(/^\+?[0-9\s-]{7,20}$/, 'Use digits, spaces or dashes').optional().or(z.literal('')),
  city: z.string().max(60).optional().or(z.literal('')),
  gender: z.enum(['male', 'female']),
})

type ProfileEditData = z.infer<typeof profileEditSchema>

export default function ProfileEditPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const form = useForm<ProfileEditData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      city: '',
      gender: 'male',
    },
    mode: 'onTouched',
  })

  const { register, watch, setValue, formState, reset } = form
  const errors = formState.errors

  // Load profile on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!cancelled && data) {
        reset({
          fullName: data.full_name ?? '',
          phone: data.phone ?? '',
          city: data.city ?? '',
          gender: data.gender ?? 'male',
        })
        setAvatarUrl(data.avatar_url ?? null)
      }
    })()
    return () => { cancelled = true }
  }, [reset])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image', variant: 'error' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large (max 5MB)', variant: 'error' })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setUploadingAvatar(true)
    try {
      // BUG 10: path must be `${user.id}/avatar.${ext}` so the RLS policy
      // (first folder segment = auth.uid) matches, and re-uploads overwrite.
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        contentType: file.type,
      })
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust for immediate UI refresh; store the clean URL in the DB (BUG 5)
      setAvatarUrl(`${publicUrl}?v=${Date.now()}`)

      // Update profile avatar_url
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)

      toast({ title: 'Avatar updated!', variant: 'success' })
    } catch (err) {
      console.error('[avatar] upload error:', err)
      toast({ title: 'Failed to upload avatar', variant: 'error' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function onSubmit(values: ProfileEditData) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast({ title: 'Session expired', variant: 'error' })
      return
    }

    setSaving(true)
    try {
      const updates = {
        full_name: values.fullName.trim(),
        phone: values.phone || null,
        city: values.city || null,
        gender: values.gender,
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (error) throw error

      toast({ title: 'Profile saved! ✅', variant: 'success' })
      router.push('/profile')
      router.refresh()
    } catch (err: unknown) {
      console.error('[profile] save error:', err)
      toast({ title: 'Failed to save', description: err instanceof Error ? err.message : 'Unknown', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Link href="/profile" className="mb-6 inline-flex items-center gap-2 text-ink-secondary hover:text-ink transition-colors">
        <Car className="h-4 w-4" />
        Back to Profile
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-ink mb-6">Edit Profile</h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar
              name={watch('fullName') || 'User'}
              src={avatarUrl}
              size="xl"
              className={uploadingAvatar ? 'opacity-50' : ''}
            />
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
            <label className="absolute bottom-0 right-0 p-1 bg-brand rounded-full text-brand-ink shadow-soft cursor-pointer hover:scale-105 transition-transform">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="sr-only" disabled={uploadingAvatar} />
              <Upload className="h-5 w-5" />
            </label>
          </div>
          <p className="text-xs text-ink-tertiary">Tap to change avatar</p>
        </div>

        {/* Full Name */}
        <Input
          label="Full Name"
          placeholder="Ali Hassan"
          leftIcon={<Mail className="h-4 w-4" />}
          {...register('fullName')}
          error={errors.fullName?.message?.toString()}
        />

        {/* Phone */}
        <Input
          label="Phone"
          type="tel"
          placeholder="+92 300 1234567"
          leftIcon={<Phone className="h-4 w-4" />}
          rightSlot={<span className="text-sm font-medium text-ink px-2">+92</span>}
          {...register('phone')}
          error={errors.phone?.message?.toString()}
        />

        {/* Gender */}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-secondary">Gender <span className="text-[var(--error)]">*</span></p>
          <SegmentedControl
            ariaLabel="Gender"
            value={watch('gender') ?? ''}
            onChange={(v) => setValue('gender', v, { shouldValidate: true })}
            options={GENDER_OPTIONS}
          />
          {errors.gender?.message && <p className="mt-1 text-xs text-[var(--error)]">{errors.gender.message}</p>}
        </div>

        {/* City */}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-secondary">City <span className="text-ink-tertiary">(optional)</span></p>
          <Input
            label="City"
            placeholder="Select city"
            leftIcon={<MapPin className="h-4 w-4" />}
            {...register('city')}
            error={errors.city?.message?.toString()}
          />
          <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Quick city picks">
            {PK_CITIES.map((city) => {
              const active = watch('city')?.trim().toLowerCase() === city.toLowerCase()
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => setValue('city', city, { shouldValidate: true })}
                  aria-pressed={active}
                  className={cn(
                    'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                    active ? 'bg-nav text-brand' : 'bg-card text-ink-secondary hover:text-ink',
                  )}
                >
                  {city}
                </button>
              )
            })}
          </div>
        </div>

        {/* Vehicle details now live in the Host form (Step 4 — Review) */}

        {/* Save Button */}
        <Button type="submit" variant="primary" loading={saving} className="h-11 w-full mt-4">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Profile'
          )}
        </Button>
      </form>
    </div>
  )
}