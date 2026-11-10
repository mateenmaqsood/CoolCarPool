'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginValues } from '@/lib/validations'

function LoginCard() {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [bioSupported, setBioSupported] = useState<boolean | null>(null)
  const [bioLoading, setBioLoading] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })

  const redirectTo = params.get('redirect_to')

  useEffect(() => {
    setBioSupported(
      typeof window !== 'undefined' &&
      'credentials' in navigator &&
      'PublicKeyCredential' in window
    )
  }, [])

  async function handleBiometricLogin() {
    setBioLoading(true)
    try {
      const email = form.getValues('email')
      if (!email) {
        toast({ title: 'Enter your email first', variant: 'warning' })
        setBioLoading(false)
        return
      }

      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000,
          allowCredentials: [],
        },
      })

      // Biometric passed — retrieve stored credentials (hackathon approach)
      const stored = localStorage.getItem(`ccp-bio-${btoa(email)}`)
      if (!stored) {
        toast({
          title: 'No biometric saved for this email',
          description: 'Log in with password first to enable it.',
          variant: 'warning',
        })
        setBioLoading(false)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: atob(stored) })
      if (error) throw error

      toast({ title: 'Biometric login successful! 🔐', variant: 'success' })
      const target = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/feed'
      router.push(target)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('NotAllowed') || msg.includes('cancel')) {
        toast({ title: 'Biometric cancelled', variant: 'warning' })
      } else {
        toast({ title: 'Biometric failed — use password instead', variant: 'error' })
      }
    } finally {
      setBioLoading(false)
    }
  }

  async function onSubmit({ email, password }: LoginValues) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast({
        title: 'Login failed',
        description:
          error.message === 'Invalid login credentials'
            ? 'Wrong email or password — try again.'
            : error.message,
        variant: 'error',
      })
      return
    }
    toast({ title: 'Welcome back!', variant: 'success' })
    // Only allow same-app relative targets (middleware sanitizes too).
    const target = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/feed'
    router.push(target)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-ink">Welcome back</h1>
        <p className="text-sm text-ink-secondary">Log in to find or host your next ride.</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          {...form.register('email')}
          error={form.formState.errors.email?.message?.toString()}
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            leftIcon={<KeyRound className="h-4 w-4" />}
            {...form.register('password')}
            error={form.formState.errors.password?.message?.toString()}
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

        <Button type="submit" variant="ink" loading={form.formState.isSubmitting} className="mt-1 h-11 w-full">
          Log in
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {bioSupported && (
        <>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-ink-tertiary">or</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <Button type="button" variant="secondary" onClick={handleBiometricLogin} loading={bioLoading} className="h-11 w-full gap-2">
            <Fingerprint className="h-4 w-4" />
            Sign in with Face ID / Fingerprint
          </Button>
        </>
      )}
      {bioSupported === false && (
        <p className="text-center text-xs text-ink-tertiary">Biometric login not available on this device</p>
      )}

      <p className="text-center text-sm text-ink-secondary">
        New here?{' '}
        <Link
          href="/signup"
          className="font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-sunken" />}>
      <LoginCard />
    </Suspense>
  )
}
