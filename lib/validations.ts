import { z } from 'zod'

/* ==========================================================================
   Auth schemas
   ========================================================================== */

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signupSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Enter your full name')
    .max(80, 'Too long'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(6, 'Use at least 6 characters').max(72),
  gender: z.enum(['male', 'female'], {
    errorMap: () => ({ message: 'Select your gender — it powers safe ride matching' }),
  }),
  city: z.string().max(60).optional().or(z.literal('')),
  phone: z
    .string()
    .max(20)
    .regex(/^\+?[0-9\s-]{7,20}$/, 'Use digits, spaces or dashes')
    .optional()
    .or(z.literal('')),
})

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>

/* ==========================================================================
   Host travel form schemas (4-step wizard)
   ========================================================================== */

export const PK_CITIES = [
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Murree',
  'Nathia Gali',
  'Abbottabad',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Sialkot',
  'Karachi',
  'Naran',
  'Kaghan',
  'Hunza',
] as const

export const RECURRENCE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Field groups per wizard step — powers step-wise validation. */
export const HOST_STEP_FIELDS: string[][] = [
  ['origin', 'destination'],
  ['departure_date', 'departure_time', 'recurring_days'],
  ['total_seats', 'gender_preference', 'pickup_radius_km', 'estimated_cost_pkr'],
  ['description', 'vehicle_make', 'vehicle_model', 'vehicle_color', 'vehicle_plate'],
]

export const hostFormSchema = z
  .object({
    origin: z.string().min(2, 'Where from?').max(160),
    destination: z.string().min(2, 'Where to?').max(160),
    departure_date: z.string().min(1, 'Pick a date'),
    departure_time: z.string().min(1, 'Pick a time'),
    is_recurring: z.boolean(),
    recurring_days: z.array(z.string()),
    total_seats: z
      .number({ invalid_type_error: 'Seats required' })
      .int()
      .min(1, 'At least 1 seat')
      .max(8, 'Max 8 seats'),
    gender_preference: z.enum(['boys_only', 'girls_only', 'any']),
    pickup_radius_km: z
      .number({ invalid_type_error: 'Radius required' })
      .int()
      .min(1)
      .max(3),
    estimated_cost_pkr: z
      .number({ invalid_type_error: 'Enter an estimate' })
      .int('Whole PKR only')
      .min(1, 'Enter an amount')
      .max(1_000_000, 'That looks unrealistic'),
    description: z.string().max(500, 'Keep it under 500 characters').optional().or(z.literal('')),
    vehicle_make: z.string().max(60).optional().or(z.literal('')),
    vehicle_model: z.string().max(60).optional().or(z.literal('')),
    vehicle_color: z.string().max(60).optional().or(z.literal('')),
    vehicle_plate: z.string().max(20).optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    // Origin ≠ destination
    if (values.origin.trim().toLowerCase() === values.destination.trim().toLowerCase() && values.origin.trim() !== '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'Origin and destination must be different',
      })
    }

    // Future departure
    if (values.departure_date && values.departure_time) {
      const when = new Date(`${values.departure_date}T${values.departure_time}`)
      if (Number.isNaN(when.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['departure_time'],
          message: 'Invalid date/time',
        })
      } else if (when.getTime() < Date.now() - 60_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['departure_time'],
          message: 'Departure must be in the future',
        })
      }
    }

    // Recurring rides need at least one day
    if (values.is_recurring && values.recurring_days.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurring_days'],
        message: 'Pick at least one day',
      })
    }
  })

export type HostFormValues = z.infer<typeof hostFormSchema>

export const GENDER_PREFERENCE_OPTIONS = [
  { value: 'boys_only' as const, label: 'Boys Only', hint: 'Only male riders see this' },
  { value: 'girls_only' as const, label: 'Girls Only', hint: 'Only female riders see this' },
  { value: 'any' as const, label: 'Anyone', hint: 'Open to all verified users' },
]
