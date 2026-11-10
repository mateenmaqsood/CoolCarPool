/**
 * CoolCarPool — session refresh + route protection middleware.
 *
 * Responsibilities:
 *  1. Refresh the Supabase auth session on every matched request so Server
 *     Components never render with an expired token.
 *  2. Protect `/feed`, `/host`, `/travel/*`, `/profile/*` — unauthenticated
 *     users are redirected to `/login` (with a `redirect_to` round-trip).
 *  3. Send already-authenticated users away from guest routes `/login`,
 *     `/signup` to `/feed`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PREFIXES = ['/feed', '/host', '/travel', '/profile'] as const
const GUEST_ONLY_PATHS = ['/login', '/signup'] as const

/** Only allow same-app relative paths as redirect targets. */
function sanitizeRedirectPath(rawPath: string): string | null {
  if (!rawPath.startsWith('/') || rawPath.startsWith('//')) return null
  return rawPath
}

/**
 * Copy cookies the middleware client already refreshed onto a redirect
 * response, otherwise the refreshed tokens are silently dropped.
 */
function redirectWithCookies(target: URL, response: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(target)
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })
  return redirectResponse
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // IMPORTANT: do not use `getSession()` here — `getUser()` actually
  // validates the JWT with Supabase Auth and re-issues refreshes.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const isGuestOnly = GUEST_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )

  // 1. Unauthenticated user trying to reach an app page → /login
  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    const redirectTo = sanitizeRedirectPath(pathname + request.nextUrl.search)
    if (redirectTo) {
      loginUrl.searchParams.set('redirect_to', redirectTo)
    }
    return redirectWithCookies(loginUrl, supabaseResponse)
  }

  // 2. Authenticated user visiting login/signup → straight to the feed
  if (user && isGuestOnly) {
    const feedUrl = request.nextUrl.clone()
    feedUrl.pathname = '/feed'
    feedUrl.search = ''
    return redirectWithCookies(feedUrl, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match every request path except:
     * - _next/static, _next/image (build assets, image optimization)
     * - favicon.ico and common static image extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
