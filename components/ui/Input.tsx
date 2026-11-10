'use client'

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  /** Icon rendered inside the field on the left (sets left padding). */
  leftIcon?: ReactNode
  /** Extra content rendered inside the field on the right (e.g. unit chips). */
  rightSlot?: ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, helperText, error, leftIcon, rightSlot, containerClassName, className, id, ...props },
    ref,
  ) => {
    // Auto-generate a stable id so <label htmlFor> always pairs up.
    const autoId = useId()
    const inputId = id ?? autoId
    const hasError = Boolean(error)

    return (
      <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
        {label ? (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-ink-secondary"
          >
            {label}
          </label>
        ) : null}

        <div
          className={cn(
            'group flex h-12 w-full items-center gap-2 rounded-pill border bg-elevated px-4 transition-all duration-150',
            'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft',
            hasError && 'border-[var(--error)] focus-within:border-[var(--error)] focus-within:ring-[color-mix(in_srgb,var(--error)_18%,transparent)]',
            !hasError && 'border-line',
            props.disabled && 'pointer-events-none opacity-60',
            className,
          )}
        >
          {leftIcon ? (
            <span className={cn('shrink-0 text-ink-tertiary transition-colors group-focus-within:text-brand', hasError && 'text-[var(--error)]')}>
              {leftIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError || undefined}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className="h-full w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
            {...props}
          />

          {rightSlot ? <span className="shrink-0 text-xs font-medium text-ink-tertiary">{rightSlot}</span> : null}
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-[var(--error)]">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-xs text-ink-tertiary">
            {helperText}
          </p>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'
