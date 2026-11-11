'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { PK_CITIES, signupSchema, type SignupValues } from '@/lib/validations'
import { cn } from '@/lib/utils'

const GENDER_OPTIONS = [
  { value: 'male' as const, label: 'Male' },
  { value: 'female' as const, label: 'Female' },
]

export default function SignupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', city: '', phone: '' },
    mode: 'onTouched',
  })
  const { register, formState, watch, setValue } = form
  const errors = formState.errors

  async function onSubmit(values: SignupValues) {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          gender: values.gender,
          city: values.city || '',
          phone: values.phone || '',
        },
      },
    })

    if (error) {
      toast({
        title: 'Sign up failed',
        description:
          error.message || 'Something went wrong — double-check your details and retry.',
        variant: 'error',
      })
      return
    }

    // Email confirmation enabled → no session yet; ask the user to verify.
    if (!data.user) {
      toast({
        title: 'Check your inbox',
        description: 'Confirm your email to activate your account.',
        variant: 'success',
        durationMs: 7000,
      })
      router.push('/login')
      return
    }

    // Ensure the profile row exists. The on_auth_user_created trigger normally
    // creates it from raw_user_meta_data; this upsert is an idempotent
    // fallback (and tops up city/phone) that won't 23505 on conflict.
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        full_name: values.fullName,
        gender: values.gender,
        city: values.city || null,
        phone: values.phone || null,
        email_verified: false,
        phone_verified: false,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      // Session exists but profile row failed — surface it, still let them in.
      console.error('[signup] profile insert failed:', profileError.message)
      toast({
        title: 'Account created — finishing profile',
        description: 'We could not fully create your profile. Open Profile to complete it.',
        variant: 'warning',
        durationMs: 6000,
      })
    } else {
      toast({ title: 'Account created 🎉', description: 'Your ride circle is ready.', variant: 'success' })
    }

    // Offer biometric login enablement
    if (typeof window !== 'undefined' && 'credentials' in navigator) {
      const enable = window.confirm('Enable biometric login (Face ID / Fingerprint) on this device?')
      if (enable) {
        localStorage.setItem(`ccp-bio-${btoa(values.email)}`, btoa(values.password))
        toast({ title: 'Biometric login enabled! 🔐', variant: 'success' })
      }
    }

    router.push('/feed')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-ink">Create your account</h1>
        <p className="text-sm text-ink-secondary">
          Gender powers safe ride matching — it is required and stored on your profile.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Ali Hassan"
          leftIcon={<UserRound className="h-4 w-4" />}
          {...register('fullName')}
          error={errors.fullName?.message?.toString()}
        />

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          {...register('email')}
          error={errors.email?.message?.toString()}
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            leftIcon={<KeyRound className="h-4 w-4" />}
            {...register('password')}
            error={errors.password?.message?.toString()}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-[30px] rounded-full p-1 text-ink-tertiary transition-colors hover:text-ink"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Gender — required by domain rules */}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-secondary">
            Gender <span className="text-[var(--error)]">*</span>
          </p>
          <SegmentedControl
            ariaLabel="Gender"
            value={watch('gender') ?? ''}
            onChange={(v) => setValue('gender', v, { shouldValidate: true })}
            options={GENDER_OPTIONS}
          />
          {errors.gender?.message ? (
            <p className="mt-1 text-xs text-[var(--error)]">{errors.gender.message}</p>
          ) : null}
        </div>

        {/* City */}
        <div>
          <label htmlFor="signup-city" className="mb-1.5 block text-[13px] font-medium text-ink-secondary">
            City <span className="text-ink-tertiary">(optional)</span>
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
            <select
              id="signup-city"
              {...register('city')}
              className="h-10 w-full appearance-none rounded-xl border border-line bg-elevated pl-9 pr-3 text-sm text-ink outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand-soft"
            >
              <option value="">Select your city…</option>
              {PK_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Phone"
          type="tel"
          autoComplete="tel"
          placeholder="300 1234567"
          leftIcon={<Phone className="h-4 w-4" />}
          rightSlot={<span className="text-sm font-medium text-ink px-2">+92</span>}
          helperText="Visible to ride members only after your seat is accepted"
          {...register('phone')}
          error={errors.phone?.message?.toString()}
        />

        <Button type="submit" variant="ink" loading={formState.isSubmitting} className="mt-1 h-11 w-full">
          Complete Signup
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="text-center text-sm text-ink-secondary">
        Already riding with us?{' '}
        <Link
          href="/login"
          className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}
