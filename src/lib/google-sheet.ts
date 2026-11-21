// Downloads a Google Sheet as .xlsx. Only the sheet ID is taken from the input — the export URL is
// always built here, so callers can't point the server at arbitrary hosts.

const MAX_BYTES = 25 * 1024 * 1024
const SHEET_ID_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/

export class SheetFetchError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export function sheetIdFromUrl(url: unknown): string | null {
  return typeof url === 'string' ? url.trim().match(SHEET_ID_RE)?.[1] ?? null : null
}

export async function fetchSheetXlsx(sheetId: string): Promise<ArrayBuffer> {
  let res: Response
  try {
    res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new SheetFetchError('تعذر الاتصال بجوجل شيتس — حاول مرة أخرى', 502)
  }

  if (res.status === 404) throw new SheetFetchError('الشيت غير موجود — تأكد من الرابط', 404)

  // A sheet that isn't shared doesn't 403 — Google redirects to its sign-in page and returns HTML.
  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || !contentType.includes('spreadsheetml')) {
    throw new SheetFetchError('لا يمكن الوصول للشيت — من جوجل شيتس اضغط "مشاركة" واجعل الوصول "أي شخص لديه الرابط" (عارض)', 403)
  }

  const buf = await res.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) throw new SheetFetchError('الشيت كبير جداً (أكثر من 25 ميجا)', 413)
  return buf
}
