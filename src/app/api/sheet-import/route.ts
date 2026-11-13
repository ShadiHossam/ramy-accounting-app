import { NextRequest, NextResponse } from 'next/server'

// Downloads a Google Sheet as .xlsx so the browser can hand it to the same parser used for uploaded
// files. Google's export URL doesn't allow cross-origin reads, so the fetch has to happen here.
// Only the sheet ID is taken from the user — the export URL is built server-side, so this route
// can't be pointed at arbitrary hosts.

const MAX_BYTES = 25 * 1024 * 1024
const SHEET_ID_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({})) as { url?: string }
  const match = typeof url === 'string' ? url.trim().match(SHEET_ID_RE) : null
  if (!match) return fail('الرابط غير صالح — انسخ رابط شيت جوجل كما هو من المتصفح (يبدأ بـ https://docs.google.com/spreadsheets/d/)')

  let res: Response
  try {
    res = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    return fail('تعذر الاتصال بجوجل شيتس — حاول مرة أخرى', 502)
  }

  if (res.status === 404) return fail('الشيت غير موجود — تأكد من الرابط', 404)

  // A sheet that isn't shared doesn't 403 — Google redirects to its sign-in page and returns HTML.
  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || !contentType.includes('spreadsheetml')) {
    return fail('لا يمكن الوصول للشيت — من جوجل شيتس اضغط "مشاركة" واجعل الوصول "أي شخص لديه الرابط" (عارض)', 403)
  }

  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) return fail('الشيت كبير جداً (أكثر من 25 ميجا)', 413)

  return new NextResponse(buf, {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  })
}
