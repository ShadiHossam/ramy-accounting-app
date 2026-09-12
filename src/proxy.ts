import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

// Uploading a file is open to anyone; seeing what's already stored (every other page, reading or
// deleting the data, the AI routes) needs a login.
const PUBLIC_PATHS = ['/', '/upload', '/login', '/api/auth/login']

const isPublic = (pathname: string, method: string) =>
  PUBLIC_PATHS.includes(pathname) || (pathname === '/api/financial-data' && method === 'POST')

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const loggedIn = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)

  if (isPublic(pathname, req.method)) {
    if (loggedIn && pathname === '/login') return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.next()
  }

  if (loggedIn) return NextResponse.next()

  // API calls get a 401 instead of a redirect — the financial data must never be readable without a session.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'غير مصرح — سجّل الدخول أولاً' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', pathname + search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Everything except build assets and the public/ icons, so the login page itself can still load its CSS/JS.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
}
