'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

/** Sign-out button for the profile page — works on mobile where the
 *  desktop avatar dropdown isn't reachable. */
export function ProfileSignOut() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function signOut() {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      loading={loading}
      onClick={() => void signOut()}
      className="w-full justify-center gap-2 text-[var(--error)] hover:border-[var(--error)] hover:text-[var(--error)]"
    >
      <LogOut className="h-4 w-4" />
      Log out
    </Button>
  )
}