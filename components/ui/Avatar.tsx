'use client'

import { useState } from 'react'
import { avatarHue, cn, initials } from '@/lib/utils'

const SIZES = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
} as const

export interface AvatarProps {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  /** Small status dot in the corner. */
  presence?: 'online' | 'offline' | null
  className?: string
}

/**
 * Avatar with deterministic gradient fallback (initials). Uses a plain <img>
 * on purpose: avatar URLs come from Supabase Storage buckets at runtime and
 * would otherwise need remotePatterns config per domain.
 */
export function Avatar({ name, src, size = 'md', presence = null, className }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = Boolean(src) && !imgFailed
  const hue = avatarHue(name)

  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={name}
          onError={() => setImgFailed(true)}
          className={cn('rounded-full object-cover', SIZES[size])}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            'flex items-center justify-center rounded-full font-semibold text-white',
            SIZES[size],
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, hsl(${hue} 72% 52%), hsl(${(hue + 40) % 360} 72% 40%))`,
          }}
        >
          {initials(name)}
        </span>
      )}

      {presence ? (
        <span
          aria-hidden
          className={cn(
            'absolute bottom-0 right-0 block rounded-full border-2 border-elevated',
            size === 'xs' || size === 'sm' ? 'h-2 w-2' : 'h-3 w-3',
            presence === 'online' ? 'bg-[var(--ok)]' : 'bg-[var(--fg-tertiary)]',
          )}
        />
      ) : null}
    </span>
  )
}
