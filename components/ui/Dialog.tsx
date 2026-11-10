'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export interface DialogContentProps {
  title: string
  description?: string
  children: ReactNode
  /** Extra classes for the inner card. */
  className?: string
  /** Render your own footer actions; the close button stays top-right. */
  showClose?: boolean
}

/**
 * Radix Dialog wrapper: overlay + centered card, entrance animations from the
 * Tailwind keyframes (no framer-motion dependency needed).
 */
export function DialogContent({
  title,
  description,
  children,
  className,
  showClose = true,
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto focus:outline-none"
      >
        <div
          className={cn(
            'relative rounded-2xl border border-line bg-elevated p-6 shadow-float animate-scale-in',
            className,
          )}
        >
          <div className="mb-4 pr-8">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-ink-secondary">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>

          {showClose ? (
            <DialogPrimitive.Close
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-tertiary transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          ) : null}

          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
