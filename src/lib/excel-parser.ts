import * as XLSX from 'xlsx'
import { Account, AccountType, JournalLine } from './types'

const ACCOUNT_TYPES: AccountType[] = ['أصول', 'خصوم', 'حقوق ملكية', 'إيرادات', 'مصروفات']

export interface ParsedAccount extends Account {}
export interface ParsedJournalLine extends Omit<JournalLine, 'id'> {}

export interface ParseResult {
  accounts: ParsedAccount[]
  entries: ParsedJournalLine[]
  errors: string[]
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v)
}

// SheetJS's Excel-serial→Date conversion can leave a few seconds of floating-point rounding
// error, occasionally landing just before local midnight instead of exactly on it (observed:
// a cell meaning "Aug 1 00:00:00" parsed as "Jul 31 23:59:48") — which silently drops the entry
// into the wrong calendar month everywhere this app groups by month. Snapping to the nearest
// calendar day corrects it without needing to touch timezone handling at all.
function snapToDay(d: Date): Date {
  const snapped = new Date(d)
  if (snapped.getHours() >= 12) snapped.setDate(snapped.getDate() + 1)
  snapped.setHours(0, 0, 0, 0)
  return snapped
}

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return snapToDay(v)
  if (isNum(v)) {
    // Excel serial date fallback (only hit if the workbook wasn't read with cellDates).
    const parsed = XLSX.SSF.parse_date_code(v)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  return null
}

function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
}

function stripTatweel(s: string): string {
  return s.replace(/ـ/g, '').trim()
}

// كود الحساب | اسم الحساب | نوع الحساب | الحساب الرئيسي | المستوى | الحالة
function parseAccounts(ws: XLSX.WorkSheet, errors: string[]): ParsedAccount[] {
  const rows = sheetRows(ws)
  const headerIdx = rows.findIndex(r => String(r?.[0] ?? '').trim() === 'كود الحساب')
  if (headerIdx === -1) {
    errors.push('تعذر إيجاد صف رؤوس الأعمدة (كود الحساب) في شيت "دليل الحسابات"')
    return []
  }

  const accounts: ParsedAccount[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const code = row?.[0]
    if (!isNum(code)) continue

    const type = String(row?.[2] ?? '').trim() as AccountType
    if (!ACCOUNT_TYPES.includes(type)) {
      errors.push(`الحساب ${code} له نوع غير معروف: "${row?.[2]}" — تم تجاهله`)
      continue
    }

    const parentRaw = row?.[3]
    const parentCode = isNum(parentRaw) ? parentRaw : null

    accounts.push({
      code,
      name: String(row?.[1] ?? '').trim(),
      type,
      parentCode,
      level: isNum(row?.[4]) ? row[4] : 1,
    })
  }
  return accounts
}

// رقم القيد | تاريخ القيد | تاريخ الترحيل | رقم المرجع | نوع المستند | البيان | كود الحساب |
// اسم الحساب | مركز التكلفة | مدين | دائن | حالة الاعتماد
function parseJournal(ws: XLSX.WorkSheet, accountsByCode: Map<number, ParsedAccount>, errors: string[]): ParsedJournalLine[] {
  const rows = sheetRows(ws)
  const headerIdx = rows.findIndex(r => String(r?.[0] ?? '').trim() === 'رقم القيد')
  if (headerIdx === -1) {
    errors.push('تعذر إيجاد صف رؤوس الأعمدة (رقم القيد) في شيت "قيود اليومية"')
    return []
  }

  const entries: ParsedJournalLine[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const entryNumber = row?.[0]
    if (!isNum(entryNumber)) continue

    const accountCode = row?.[6]
    if (!isNum(accountCode)) {
      errors.push(`القيد رقم ${entryNumber}: كود حساب غير صالح — تم تجاهل السطر`)
      continue
    }

    const account = accountsByCode.get(accountCode)
    if (!account) {
      errors.push(`القيد رقم ${entryNumber}: الحساب ${accountCode} غير موجود في دليل الحسابات — تم تجاهل السطر`)
      continue
    }

    const entryDate = asDate(row?.[1])
    const postingDate = asDate(row?.[2]) ?? entryDate
    if (!entryDate) {
      errors.push(`القيد رقم ${entryNumber}: تاريخ القيد غير صالح — تم تجاهل السطر`)
      continue
    }

    entries.push({
      entryNumber,
      entryDate,
      postingDate: postingDate ?? entryDate,
      refNumber: String(row?.[3] ?? '').trim(),
      docType: String(row?.[4] ?? '').trim(),
      description: String(row?.[5] ?? '').trim(),
      accountCode,
      accountName: account.name,
      accountType: account.type,
      costCenter: String(row?.[8] ?? '').trim(),
      debit: isNum(row?.[9]) ? row[9] : 0,
      credit: isNum(row?.[10]) ? row[10] : 0,
      approvalStatus: String(row?.[11] ?? '').trim(),
    })
  }

  // Every individual entry (all lines sharing one رقم القيد) must debit = credit on its own —
  // this is what makes the balance sheet tie out later without any reconciling/invented figure.
  // Reported as a warning (using only literal summed values), never silently corrected.
  const byEntry = new Map<number, { debit: number; credit: number }>()
  for (const e of entries) {
    const cur = byEntry.get(e.entryNumber) ?? { debit: 0, credit: 0 }
    cur.debit += e.debit
    cur.credit += e.credit
    byEntry.set(e.entryNumber, cur)
  }
  for (const [entryNumber, { debit, credit }] of byEntry) {
    if (Math.abs(debit - credit) > 0.01) {
      errors.push(`القيد رقم ${entryNumber} غير متوازن: مدين ${debit.toLocaleString('ar-EG')} ≠ دائن ${credit.toLocaleString('ar-EG')}`)
    }
  }

  return entries
}

export interface OpeningBalanceResult {
  extraAccounts: ParsedAccount[]
  openingLines: ParsedJournalLine[]
  errors: string[]
}

// البيان (label) | كود الحساب (code) | المبلغ (amount) — column 2 is always the amount. Only
// rows carrying BOTH a code and an amount are leaf account balances; section headers, account-
// group headers (e.g. "الاصول المتداولة" — has a code but no amount, it's the group itself, not
// a balance), and subtotal/total rows (have an amount but no code) are skipped automatically by
// that same rule, without needing to separately detect which kind of row each one is.
function parseOpeningBalance(
  ws: XLSX.WorkSheet,
  accountsByCode: Map<number, ParsedAccount>,
  errors: string[]
): { extraAccounts: ParsedAccount[]; lines: { accountCode: number; amount: number }[]; asOfDate: Date | null } {
  const rows = sheetRows(ws)

  let asOfDate: Date | null = null
  for (const row of rows) {
    const title = stripTatweel(String(row?.[0] ?? ''))
    const m = title.match(/فى\s*(\d{1,2})-(\d{1,2})-(\d{4})/)
    if (m) {
      asOfDate = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
      break
    }
  }
  if (!asOfDate) {
    errors.push('تعذر إيجاد تاريخ "قائمة المركز المالى" في عنوان شيت الرصيد الافتتاحي — تم تجاهل الملف')
    return { extraAccounts: [], lines: [], asOfDate: null }
  }

  const extraAccounts: ParsedAccount[] = []
  const lines: { accountCode: number; amount: number }[] = []
  // The account TYPE for any code not already in دليل الحسابات is only knowable from which
  // section heading it physically falls under in this sheet — tracked the same way the old
  // monthly-summary balance-sheet parser tracked assets/liabilities/equity sections.
  let section: AccountType | null = null

  for (const row of rows) {
    const rawLabel = String(row?.[0] ?? '').trim()
    if (!rawLabel) continue
    const label = stripTatweel(rawLabel)

    if (label.includes('حقوق الملكية')) { section = 'حقوق ملكية'; continue }
    if (label.includes('الالتزامات')) { section = 'خصوم'; continue }
    if (label === 'الاصول') { section = 'أصول'; continue }

    const code = row?.[1]
    const amount = row?.[2]
    if (!isNum(code) || !isNum(amount)) continue

    let account = accountsByCode.get(code)
    if (!account) {
      if (!section) {
        errors.push(`تعذر تصنيف الحساب "${rawLabel}" (كود ${code}) في الرصيد الافتتاحي — لا يوجد قسم معروف له، تم تجاهله`)
        continue
      }
      const root = Array.from(accountsByCode.values()).find(a => a.level === 1 && a.type === section)
      account = { code, name: rawLabel, type: section, parentCode: root ? root.code : null, level: 2 }
      accountsByCode.set(code, account)
      extraAccounts.push(account)
      errors.push(`الحساب "${rawLabel}" (كود ${code}) غير موجود في دليل الحسابات — تمت إضافته تلقائياً كحساب ${section} برصيد افتتاحي ${amount.toLocaleString('ar-EG')}`)
    }

    lines.push({ accountCode: code, amount })
  }

  return { extraAccounts, lines, asOfDate }
}

// Turns a "قائمة المركز المالى" workbook into: (a) any account codes it uses that aren't in the
// main دليل الحسابات yet, and (b) one opening journal entry (entry #0) dated the day before the
// stated as-of date, so it sits chronologically before every real transaction and its balances
// simply accumulate into whatever those transactions add on top — no merging/reconciliation logic,
// just another (earlier) entry in the same ledger.
export function parseOpeningBalanceFile(file: File, existingAccounts: ParsedAccount[]): Promise<OpeningBalanceResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => {
      resolve({ extraAccounts: [], openingLines: [], errors: ['فشل في قراءة ملف الرصيد الافتتاحي'] })
    }
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const errors: string[] = []
        const accountsByCode = new Map(existingAccounts.map(a => [a.code, a]))

        const bsWs = wb.Sheets['قائمة المركز المالى']
        if (!bsWs) {
          errors.push('لم يتم العثور على شيت "قائمة المركز المالى" في ملف الرصيد الافتتاحي')
          resolve({ extraAccounts: [], openingLines: [], errors })
          return
        }

        const { extraAccounts, lines, asOfDate } = parseOpeningBalance(bsWs, accountsByCode, errors)
        if (!asOfDate || lines.length === 0) {
          resolve({ extraAccounts, openingLines: [], errors })
          return
        }

        const openingDate = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate() - 1)

        const openingLines: ParsedJournalLine[] = lines.map(({ accountCode, amount }) => {
          const account = accountsByCode.get(accountCode)!
          const isDebitNormal = account.type === 'أصول' || account.type === 'مصروفات'
          const debit = isDebitNormal ? Math.max(amount, 0) : Math.max(-amount, 0)
          const credit = isDebitNormal ? Math.max(-amount, 0) : Math.max(amount, 0)
          return {
            entryNumber: 0,
            entryDate: openingDate,
            postingDate: openingDate,
            refNumber: 'OB',
            docType: 'رصيد افتتاحي',
            description: 'رصيد افتتاحي',
            accountCode,
            accountName: account.name,
            accountType: account.type,
            costCenter: '',
            debit, credit,
            approvalStatus: '',
          }
        })

        const totalDebit = openingLines.reduce((s, l) => s + l.debit, 0)
        const totalCredit = openingLines.reduce((s, l) => s + l.credit, 0)
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          errors.push(`الرصيد الافتتاحي غير متوازن: مدين ${totalDebit.toLocaleString('ar-EG')} ≠ دائن ${totalCredit.toLocaleString('ar-EG')} (الملف الأصلي نفسه غير متوازن بهذا الفارق) — تم استيراده كما هو دون أي تعديل`)
        }

        resolve({ extraAccounts, openingLines, errors })
      } catch (err) {
        resolve({ extraAccounts: [], openingLines: [], errors: [String(err)] })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => {
      resolve({ accounts: [], entries: [], errors: ['فشل في قراءة الملف. تأكد من أن الملف غير تالف وحاول مرة أخرى'] })
    }
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const errors: string[] = []

        const accountsWs = wb.Sheets['دليل الحسابات']
        const accounts = accountsWs ? parseAccounts(accountsWs, errors) : []
        if (!accountsWs) errors.push('لم يتم العثور على شيت "دليل الحسابات" في الملف')

        const accountsByCode = new Map(accounts.map(a => [a.code, a]))

        const journalWs = wb.Sheets['قيود اليومية']
        const entries = journalWs ? parseJournal(journalWs, accountsByCode, errors) : []
        if (!journalWs) errors.push('لم يتم العثور على شيت "قيود اليومية" في الملف')

        if (accounts.length === 0 && entries.length === 0) {
          errors.push('لم يتم العثور على بيانات صالحة في الملف')
        }

        resolve({ accounts, entries, errors })
      } catch (err) {
        resolve({ accounts: [], entries: [], errors: [String(err)] })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
