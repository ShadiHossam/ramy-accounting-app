import { NextRequest, NextResponse } from 'next/server'
import { fetchSheetXlsx, sheetIdFromUrl, SheetFetchError } from '@/lib/google-sheet'

// Downloads a Google Sheet as .xlsx so the browser can hand it to the same parser used for uploaded
// files. Google's export URL doesn't allow cross-origin reads, so the fetch has to happen here.

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({})) as { url?: string }
  const sheetId = sheetIdFromUrl(url)
  if (!sheetId) {
    return NextResponse.json({ error: 'الرابط غير صالح — انسخ رابط شيت جوجل كما هو من المتصفح (يبدأ بـ https://docs.google.com/spreadsheets/d/)' }, { status: 400 })
  }
  try {
    const buf = await fetchSheetXlsx(sheetId)
    return new NextResponse(buf, {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    })
  } catch (err) {
    const e = err instanceof SheetFetchError ? err : new SheetFetchError('حدث خطأ غير متوقع', 500)
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
}
