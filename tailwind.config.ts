import type { Config } from 'tailwindcss'

/**
 * CoolCarPool — Tailwind theme.
 *
 * Colors map 1:1 to the CSS variables in app/globals.css, so every utility
 * (bg-elevated, border-line, text-ink-secondary, bg-brand, ...) flips
 * automatically with [data-theme="dark"].
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        elevated: 'var(--bg-elevated)',
        sunken: 'var(--bg-sunken)',
        ink: {
          DEFAULT: 'var(--fg-primary)',
          secondary: 'var(--fg-secondary)',
          tertiary: 'var(--fg-tertiary)',
        },
        line: 'var(--border)',
        'line-focus': 'var(--border-focus)',
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          soft: 'var(--brand-soft)',
        },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        error: 'var(--error)',
        'accent-from': 'var(--accent-from)',
        'accent-to': 'var(--accent-to)',
        overlay: 'var(--overlay)',
      },
      borderRadius: {
        pill: '100px',
      },
      boxShadow: {
        soft: 'var(--shadow-sm)',
        card: 'var(--shadow-md)',
        float: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'progress-fill': {
          from: { width: '0%' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-8deg)' },
          '75%': { transform: 'rotate(8deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.15)',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'progress-fill': 'progress-fill 0.9s cubic-bezier(0.3, 0.8, 0.3, 1) forwards',
        wiggle: 'wiggle 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
}

export default config
