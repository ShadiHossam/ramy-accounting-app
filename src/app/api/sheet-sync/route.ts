import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import { readSyncStatus, syncFromSheet } from '@/lib/sheet-sync'

// GET: last sync status. POST: sync now. Allowed for a logged-in user, or for the server cron
// via the x-sync-token header (SYNC_TOKEN env var). proxy.ts lets POST through unauthenticated
// so the cron can reach this handler; the check below is what actually guards it.

async function authorized(req: NextRequest) {
  const token = process.env.SYNC_TOKEN
  const given = req.headers.get('x-sync-token')
  if (token && token.length >= 16 && given === token) return true
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
}

export async function GET() {
  return NextResponse.json(await readSyncStatus())
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const force = req.nextUrl.searchParams.get('force') === '1'
  return NextResponse.json(await syncFromSheet({ force }))
}
