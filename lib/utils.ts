import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** "Rs 2,500" style PKR formatting. */
export function formatPKR(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** "Sat, Feb 14 · 3:00 PM" style formatting for departure timestamps. */
export function formatDeparture(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/** "in 2 days", "in 55 min", "2 h ago". */
export function timeUntil(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = date.getTime() - Date.now()
  const abs = Math.abs(diffMs)
  const suffix = diffMs >= 0 ? '' : ' ago'
  const prefix = diffMs >= 0 ? 'in ' : ''
  if (abs < 60_000) return 'now'
  if (abs < 3_600_000) return `${prefix}${Math.round(abs / 60_000)} min${suffix}`
  if (abs < 86_400_000) return `${prefix}${Math.round(abs / 3_600_000)} h${suffix}`
  return `${prefix}${Math.round(abs / 86_400_000)} d${suffix}`
}

/** Deterministic 2-letter initials for avatar fallbacks. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? '?'
  const second = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + second).toUpperCase()
}

/** Cheap string hash → hue for deterministic avatar gradient colors. */
export function avatarHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

/** Combine a date + time form value pair into a safe ISO timestamp (local). */
export function combineDateAndTime(date: string, time: string): string | null {
  if (!date || !time) return null
  const when = new Date(`${date}T${time}`)
  if (Number.isNaN(when.getTime())) return null
  return when.toISOString()
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`
}

export function minutesLabel(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours)) return null
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min apart`
  return `${Math.round(hours * 10) / 10} h apart`
}
