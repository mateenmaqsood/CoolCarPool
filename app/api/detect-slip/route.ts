/**
 * CoolCarPool — POST /api/detect-slip
 *
 * AI bill-slip OCR: extracts the total PKR amount from an uploaded fuel/toll
 * receipt photo using Anthropic claude-sonnet-4-6.
 *
 * Request: multipart/form-data
 *   file:  image/jpeg | image/png | image/webp | image/gif — max 10 MB
 *
 * Response 200:
 *   { ok: true, total_pkr: number, ocr_source: 'anthropic' }
 * Graceful failure (never crashes the client), per CLAUDE.md guardrails:
 *   200 { ok: true, total_pkr: null, fallback: true, error: '...' }
 *        → client shows the manual amount input box
 *   400  bad upload       401 unauthenticated       405 wrong verb
 *
 * Env: ANTHROPIC_API_KEY
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MAX_FILE_BYTES = 10 * 1024 * 1024 // mirrors the bill-slips bucket limit

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const SYSTEM_PROMPT =
  'Extract total bill amount in PKR from this fuel/toll receipt image. Return JSON: { total_pkr: number }. If the receipt is unreadable or ambiguous, return { total_pkr: null }.'

/** Anthropic claude-sonnet-4-6 image response. */
interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { message?: string }
}

function extractJson(text: string): { total_pkr: number | null } | null {
  // Models occasionally wrap JSON in prose or code fences — find the first
  // balanced-looking {...} object and parse that.
  const match = text.match(/\{[\s\S]*?\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as { total_pkr: number | null }
  } catch {
    return null
  }
}

/** Coarse sanity bounds: receipts in PKR between PKR 50 and PKR 1,000,000. */
function plausiblePkr(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 50 && value <= 1_000_000
}

function fallbackResponse(error: string, status = 200) {
  return NextResponse.json(
    { ok: true, total_pkr: null, fallback: true, error },
    { status },
  )
}

export async function POST(request: Request) {
  // Auth gate — only signed-in members may run slip OCR.
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Deploy guardrail: no key configured → manual input, no crash.
    return fallbackResponse('ANTHROPIC_API_KEY not configured — enter the amount manually.')
  }

  // --- Parse multipart upload -------------------------------------------
  let file: File
  try {
    const form = await request.formData()
    const entry = form.get('file')
    if (!entry || typeof entry === 'string') {
      return NextResponse.json(
        { ok: false, error: 'Expected multipart field "file" containing the receipt image.' },
        { status: 400 },
      )
    }
    file = entry as File
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Request must be multipart/form-data with a "file" image.' },
      { status: 400 },
    )
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported file type "${file.type}". Use JPEG, PNG, WebP or GIF.` },
      { status: 400 },
    )
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'Image too large (max 10 MB).' },
      { status: 400 },
    )
  }

  // --- Call Anthropic ----------------------------------------------------
  const bytes = Buffer.from(await file.arrayBuffer())

  let anthropicRes: Response
  try {
    anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: file.type,
                  data: bytes.toString('base64'),
                },
              },
              {
                type: 'text',
                text: 'Return only the JSON object.',
              },
            ],
          },
        ],
      }),
    })
  } catch (error) {
    console.error('[POST /api/detect-slip] network failure:', error)
    return fallbackResponse('OCR service unreachable — enter the amount manually.')
  }

  if (!anthropicRes.ok) {
    console.error('[POST /api/detect-slip] anthropic error:', anthropicRes.status)
    return fallbackResponse(`OCR service error (HTTP ${anthropicRes.status}) — enter the amount manually.`)
  }

  let payload: AnthropicResponse
  try {
    payload = (await anthropicRes.json()) as AnthropicResponse
  } catch {
    return fallbackResponse('Unparseable OCR response — enter the amount manually.')
  }

  if (payload.error?.message) {
    console.error('[POST /api/detect-slip] anthropic API error:', payload.error.message)
    return fallbackResponse('OCR rejected the image — enter the amount manually.')
  }

  const text = (payload.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')

  if (!text) {
    return fallbackResponse('OCR returned no content — enter the amount manually.')
  }

  const parsed = extractJson(text)
  if (!parsed) {
    return fallbackResponse('Could not read a total from this receipt — enter the amount manually.')
  }

  if (!plausiblePkr(parsed.total_pkr)) {
    return fallbackResponse('Receipt total unreadable or out of range — enter the amount manually.')
  }

  return NextResponse.json(
    { ok: true, total_pkr: Math.round(parsed.total_pkr), ocr_source: 'anthropic' },
    { status: 200 },
  )
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. POST multipart/form-data with a "file" image.' },
    { status: 405 },
  )
}
