import { NextRequest, NextResponse } from 'next/server'
import {
  checkCredentials, createSessionToken, isAuthConfigured, isHttpsRequest, SESSION_COOKIE, SESSION_MAX_AGE,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: 'تسجيل الدخول غير مفعّل على السيرفر — متغيرات AUTH_USERNAME و AUTH_PASSWORD و AUTH_SECRET غير مضبوطة' },
      { status: 500 },
    )
  }

  const body = await req.json().catch(() => ({})) as { username?: unknown; password?: unknown }
  const ok = await checkCredentials(String(body.username ?? ''), String(body.password ?? ''))

  if (!ok) {
    // Slows down password guessing without needing a rate-limit store.
    await new Promise(resolve => setTimeout(resolve, 1000))
    return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: isHttpsRequest(req),
  })
  return res
}
