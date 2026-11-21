import { NextRequest, NextResponse } from 'next/server'
import { AS_OF_RE, readSyncStatus, syncFromSheet } from '@/lib/sheet-sync'

// GET: last pull status. POST { asOf?: "YYYY-MM-DD" }: pull the Google Sheet now, keeping journal
// entries up to and including asOf. Both need a login (enforced by proxy.ts).

export async function GET() {
  return NextResponse.json(await readSyncStatus())
}

export async function POST(req: NextRequest) {
  const { asOf } = await req.json().catch(() => ({})) as { asOf?: unknown }
  if (asOf != null && asOf !== '' && (typeof asOf !== 'string' || !AS_OF_RE.test(asOf))) {
    return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
  }
  return NextResponse.json(await syncFromSheet({ asOf: (asOf as string) || null }))
}
