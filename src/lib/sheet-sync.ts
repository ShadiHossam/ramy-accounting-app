import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { fetchSheetXlsx, sheetIdFromUrl, SheetFetchError } from '@/lib/google-sheet'
import { parseLedgerWorkbook } from '@/lib/excel-parser'
import { replaceLedger } from '@/lib/ledger-store'

// Keeps the stored ledger in step with the client's Google Sheet (GOOGLE_SHEET_URL), which they
// keep up to date as their single source of truth. Run by a daily server cron (06:07 Cairo) and by
// the "مزامنة" button. Every sync is a full replace (same as an upload), but:
//   - an unreachable / unparsable sheet never wipes the stored data — the old data stays;
//   - an unchanged sheet is skipped, so a re-run does not rewrite the DB for nothing.

export interface SyncStatus {
  configured: boolean
  lastCheckedAt: string | null
  lastSyncedAt: string | null // last time the stored data actually changed
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
  warnings: [], accountCount: 0, entryCount: 0, dataHash: null,
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

let running: Promise<SyncStatus> | null = null

export function syncFromSheet(opts: { force?: boolean } = {}): Promise<SyncStatus> {
  // A button press during a cron run (or vice versa) joins the run in progress instead of racing it.
  running ??= runSync(opts.force ?? false).finally(() => { running = null })
  return running
}

async function runSync(force: boolean): Promise<SyncStatus> {
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

  const journalLines = parsed.entries.length - parsed.openingLines
  if (parsed.accounts.length === 0 || journalLines === 0) {
    return fail(`الشيت لا يحتوي على بيانات صالحة (${parsed.errors.slice(0, 3).join(' · ') || 'دليل الحسابات أو قيود اليومية فارغ'})`)
  }

  // Hash the parsed ledger, not the file bytes — Google's export can differ byte-wise for the same content.
  const dataHash = createHash('sha256').update(JSON.stringify([parsed.accounts, parsed.entries])).digest('hex')
  const base = { configured: true, lastCheckedAt: now, ok: true, warnings: parsed.errors, dataHash }

  if (!force && prev.ok && prev.dataHash === dataHash) {
    const s = { ...prev, ...base, message: 'لا توجد تغييرات في الشيت منذ آخر مزامنة' }
    await writeSyncStatus(s)
    return s
  }

  const { accountCount, entryCount } = await replaceLedger(parsed.accounts, parsed.entries, parsed.openingLines > 0)
  const s: SyncStatus = {
    ...base, lastSyncedAt: now, accountCount, entryCount,
    message: `تم تحديث البيانات من الشيت: ${accountCount} حساب، ${entryCount} سطر قيد`,
  }
  await writeSyncStatus(s)
  return s
}
