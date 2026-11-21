import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { fetchSheetXlsx, sheetIdFromUrl, SheetFetchError } from '@/lib/google-sheet'
import { parseLedgerWorkbook } from '@/lib/excel-parser'
import { replaceLedger, OPENING_BALANCE_DOC_TYPE } from '@/lib/ledger-store'

// Pulls the client's Google Sheet (GOOGLE_SHEET_URL) into the app on demand — only when someone
// presses the button; there is no automatic sync. The user picks an "as of" date and every journal
// entry dated up to and including that day is imported (the opening balance always is). Each pull
// is a full replace, like an upload, but an unreachable / unparsable sheet, or a date with no
// entries, never wipes the stored data.

export interface SyncStatus {
  configured: boolean
  lastCheckedAt: string | null
  lastSyncedAt: string | null // last time the stored data actually changed
  asOf: string | null // YYYY-MM-DD the last pull was cut off at (null = everything in the sheet)
  ok: boolean
  message: string
  warnings: string[]
  accountCount: number
  entryCount: number
  dataHash: string | null
}

const statusFile = () => process.env.SHEET_SYNC_STATUS_FILE ?? path.join(process.cwd(), '.sheet-sync-status.json')

const EMPTY: SyncStatus = {
  configured: false, lastCheckedAt: null, lastSyncedAt: null, ok: true, message: '',
  warnings: [], accountCount: 0, entryCount: 0, dataHash: null, asOf: null,
}

export async function readSyncStatus(): Promise<SyncStatus> {
  const configured = !!sheetIdFromUrl(process.env.GOOGLE_SHEET_URL)
  try {
    return { ...EMPTY, ...JSON.parse(await fs.readFile(statusFile(), 'utf8')), configured }
  } catch {
    return { ...EMPTY, configured }
  }
}

async function writeSyncStatus(s: SyncStatus) {
  await fs.writeFile(statusFile(), JSON.stringify(s, null, 2))
}

// Called after "delete all data", so the status no longer describes data that's gone.
export async function forgetSyncedData() {
  const prev = await readSyncStatus()
  if (prev.lastSyncedAt === null) return
  await writeSyncStatus({ ...prev, dataHash: null, accountCount: 0, entryCount: 0, warnings: [], message: 'تم حذف كل البيانات من السيستم' })
}

export const AS_OF_RE = /^\d{4}-\d{2}-\d{2}$/

let running: Promise<SyncStatus> | null = null

export function syncFromSheet(opts: { asOf?: string | null } = {}): Promise<SyncStatus> {
  // A second press while a pull is running joins it instead of racing it.
  running ??= runSync(opts.asOf ?? null).finally(() => { running = null })
  return running
}

async function runSync(asOf: string | null): Promise<SyncStatus> {
  const prev = await readSyncStatus()
  const now = new Date().toISOString()
  const sheetId = sheetIdFromUrl(process.env.GOOGLE_SHEET_URL)
  if (!sheetId) return { ...prev, configured: false, ok: false, message: 'رابط شيت جوجل غير مضبوط على السيرفر (GOOGLE_SHEET_URL)' }

  const fail = async (message: string) => {
    const s = { ...prev, configured: true, lastCheckedAt: now, ok: false, message: `${message} — البيانات السابقة لم تتغير` }
    await writeSyncStatus(s)
    return s
  }

  let buf: ArrayBuffer
  try {
    buf = await fetchSheetXlsx(sheetId)
  } catch (err) {
    return fail(err instanceof SheetFetchError ? err.message : 'تعذر تحميل الشيت')
  }

  // Dates in the sheet are calendar days in the client's own time zone (Egypt). Parsing them in the
  // server's zone (France) would shift every entry; browser uploads from Egypt land on the same values.
  process.env.TZ = process.env.LEDGER_TZ || 'Africa/Cairo'

  let parsed: ReturnType<typeof parseLedgerWorkbook>
  try {
    parsed = parseLedgerWorkbook(buf)
  } catch (err) {
    return fail(`تعذر قراءة الشيت: ${String(err)}`)
  }

  if (parsed.accounts.length === 0 || parsed.entries.length === parsed.openingLines) {
    return fail(`الشيت لا يحتوي على بيانات صالحة (${parsed.errors.slice(0, 3).join(' · ') || 'دليل الحسابات أو قيود اليومية فارغ'})`)
  }

  // Inclusive cut-off: end of the chosen day in the client's time zone (TZ was set above).
  let entries = parsed.entries
  if (asOf) {
    const [y, m, d] = asOf.split('-').map(Number)
    const cutoff = new Date(y, m - 1, d, 23, 59, 59, 999)
    entries = parsed.entries.filter(e => e.docType === OPENING_BALANCE_DOC_TYPE || e.entryDate <= cutoff)
    if (entries.length === parsed.openingLines) return fail(`لا توجد قيود في الشيت حتى ${asOf}`)
  }
  // Warnings only for entries that were actually imported.
  const kept = new Set(entries.filter(e => e.docType !== OPENING_BALANCE_DOC_TYPE).map(e => e.entryNumber))
  const warnings = parsed.errors.filter(w => {
    const n = w.match(/القيد رقم (\d+)/)?.[1]
    return !n || kept.has(Number(n))
  })

  const { accountCount, entryCount } = await replaceLedger(parsed.accounts, entries, parsed.openingLines > 0)
  const s: SyncStatus = {
    configured: true, lastCheckedAt: now, lastSyncedAt: now, ok: true, warnings, asOf,
    dataHash: createHash('sha256').update(JSON.stringify([parsed.accounts, entries])).digest('hex'),
    accountCount, entryCount,
    message: `تم سحب البيانات من الشيت${asOf ? ` حتى ${asOf} (شامل اليوم)` : ''}: ${accountCount} حساب، ${entryCount} سطر قيد`,
  }
  await writeSyncStatus(s)
  return s
}
