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

// Finds the header row by looking for `marker` in ANY cell (not a fixed position), then maps
// every header cell's text -> its column index. Callers look columns up by Arabic name instead
// of hardcoding an index, so inserting/reordering/appending columns in the sheet can't silently
// shift which data lands in which field — only renaming/removing a header the app depends on can.
function findHeaderRow(rows: unknown[][], marker: string): { idx: number; hmap: Map<string, number> } | null {
  const idx = rows.findIndex(r => Array.isArray(r) && r.some(cell => stripTatweel(String(cell ?? '')) === marker))
  if (idx === -1) return null
  const hmap = new Map<string, number>()
  const row = rows[idx] as unknown[]
  row.forEach((cell, i) => {
    const key = stripTatweel(String(cell ?? ''))
    if (key && !hmap.has(key)) hmap.set(key, i)
  })
  return { idx, hmap }
}

// كود الحساب | اسم الحساب | نوع الحساب | الحساب الرئيسي | المستوى | الحالة
function parseAccounts(ws: XLSX.WorkSheet, errors: string[]): ParsedAccount[] {
  const rows = sheetRows(ws)
  const header = findHeaderRow(rows, 'كود الحساب')
  if (!header) {
    errors.push('تعذر إيجاد صف رؤوس الأعمدة (كود الحساب) في شيت "دليل الحسابات"')
    return []
  }
  const { idx: headerIdx, hmap } = header

  const codeCol = hmap.get('كود الحساب')
  const nameCol = hmap.get('اسم الحساب')
  const typeCol = hmap.get('نوع الحساب')
  const parentCol = hmap.get('الحساب الرئيسي')
  const levelCol = hmap.get('المستوى')
  if (codeCol === undefined || nameCol === undefined || typeCol === undefined) {
    errors.push('أعمدة أساسية مفقودة في شيت "دليل الحسابات" (كود الحساب / اسم الحساب / نوع الحساب) — تأكد من عدم إعادة تسميتها')
    return []
  }

  const accounts: ParsedAccount[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const code = row?.[codeCol]
    if (!isNum(code)) continue

    const type = String(row?.[typeCol] ?? '').trim() as AccountType
    if (!ACCOUNT_TYPES.includes(type)) {
      errors.push(`الحساب ${code} له نوع غير معروف: "${row?.[typeCol]}" — تم تجاهله`)
      continue
    }

    const parentRaw = parentCol !== undefined ? row?.[parentCol] : undefined
    const parentCode = isNum(parentRaw) ? parentRaw : null

    accounts.push({
      code,
      name: String(row?.[nameCol] ?? '').trim(),
      type,
      parentCode,
      level: levelCol !== undefined && isNum(row?.[levelCol]) ? row[levelCol] : 1,
    })
  }
  resolveHierarchyByCode(accounts)
  return accounts
}

function isDescendantOf(code: number, ancestor: number, byCode: Map<number, ParsedAccount>): boolean {
  let cur = byCode.get(code)
  // Bounded walk so a malformed chart (an account naming itself or a loop as its parent) can't hang.
  for (let guard = 0; cur && cur.parentCode !== null && guard < 20; guard++) {
    if (cur.parentCode === ancestor) return true
    cur = byCode.get(cur.parentCode)
  }
  return false
}

// Analytical sub-accounts get added by extending a code (1110 العملاء → 11101, 11102...) while
// الحساب الرئيسي is often left pointing at the old group (1100) — read literally, that lists them as
// siblings of 1110 and counts العملاء twice. The code prefix is the accountant's real intent, so a
// sub-account is re-parented under the deepest same-type account whose code prefixes its own — but
// only when that account itself sits under the declared parent. That keeps 21020 under its declared
// 2101 instead of pulling it under the unrelated 2102 just because "21020" happens to start with "2102".
function resolveHierarchyByCode(accounts: ParsedAccount[]): void {
  const byCode = new Map(accounts.map(a => [a.code, a]))
  const reparented: ParsedAccount[] = []

  for (const acc of accounts) {
    const s = String(acc.code)
    for (let len = s.length - 1; len > 0; len--) {
      const candidate = byCode.get(Number(s.slice(0, len)))
      if (!candidate || candidate.type !== acc.type) continue
      if (candidate.code === acc.parentCode) break
      if (acc.parentCode === null || isDescendantOf(candidate.code, acc.parentCode, byCode)) {
        acc.parentCode = candidate.code
        reparented.push(acc)
        break
      }
    }
  }

  for (const acc of reparented) {
    let level = 1
    let cur: ParsedAccount | undefined = acc
    for (let guard = 0; cur && cur.parentCode !== null && guard < 20; guard++) {
      level++
      cur = byCode.get(cur.parentCode)
    }
    acc.level = level
  }
}

// رقم القيد | تاريخ القيد | تاريخ الترحيل | رقم المرجع | نوع المستند | البيان | كود الحساب |
// اسم الحساب | مركز التكلفة | مدين | دائن | حالة الاعتماد
// (اسم الحساب is deliberately never read here — the account name always comes from
// accountsByCode, so دليل الحسابات stays the single source of truth for it.)
function parseJournal(ws: XLSX.WorkSheet, accountsByCode: Map<number, ParsedAccount>, errors: string[]): ParsedJournalLine[] {
  const rows = sheetRows(ws)
  const header = findHeaderRow(rows, 'رقم القيد')
  if (!header) {
    errors.push('تعذر إيجاد صف رؤوس الأعمدة (رقم القيد) في شيت "قيود اليومية"')
    return []
  }
  const { idx: headerIdx, hmap } = header

  const col = {
    entryNumber: hmap.get('رقم القيد'),
    entryDate: hmap.get('تاريخ القيد'),
    postingDate: hmap.get('تاريخ الترحيل'),
    refNumber: hmap.get('رقم المرجع'),
    docType: hmap.get('نوع المستند'),
    description: hmap.get('البيان'),
    accountCode: hmap.get('كود الحساب'),
    costCenter: hmap.get('مركز التكلفة'),
    debit: hmap.get('مدين'),
    credit: hmap.get('دائن'),
    approvalStatus: hmap.get('حالة الاعتماد'),
  }
  if (col.entryNumber === undefined || col.entryDate === undefined || col.accountCode === undefined
    || col.debit === undefined || col.credit === undefined) {
    errors.push('أعمدة أساسية مفقودة في شيت "قيود اليومية" (رقم القيد / تاريخ القيد / كود الحساب / مدين / دائن) — تأكد من عدم إعادة تسميتها')
    return []
  }

  const entries: ParsedJournalLine[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const entryNumber = row?.[col.entryNumber]
    if (!isNum(entryNumber)) continue

    const accountCode = row?.[col.accountCode]
    if (!isNum(accountCode)) {
      errors.push(`القيد رقم ${entryNumber}: كود حساب غير صالح — تم تجاهل السطر`)
      continue
    }

    const account = accountsByCode.get(accountCode)
    if (!account) {
      errors.push(`القيد رقم ${entryNumber}: الحساب ${accountCode} غير موجود في دليل الحسابات — تم تجاهل السطر`)
      continue
    }

    const entryDate = asDate(row?.[col.entryDate])
    const postingDate = (col.postingDate !== undefined ? asDate(row?.[col.postingDate]) : null) ?? entryDate
    if (!entryDate) {
      errors.push(`القيد رقم ${entryNumber}: تاريخ القيد غير صالح — تم تجاهل السطر`)
      continue
    }

    entries.push({
      entryNumber,
      entryDate,
      postingDate: postingDate ?? entryDate,
      refNumber: col.refNumber !== undefined ? String(row?.[col.refNumber] ?? '').trim() : '',
      docType: col.docType !== undefined ? String(row?.[col.docType] ?? '').trim() : '',
      description: col.description !== undefined ? String(row?.[col.description] ?? '').trim() : '',
      accountCode,
      accountName: account.name,
      accountType: account.type,
      costCenter: col.costCenter !== undefined ? String(row?.[col.costCenter] ?? '').trim() : '',
      debit: isNum(row?.[col.debit]) ? (row[col.debit] as number) : 0,
      credit: isNum(row?.[col.credit]) ? (row[col.credit] as number) : 0,
      approvalStatus: col.approvalStatus !== undefined ? String(row?.[col.approvalStatus] ?? '').trim() : '',
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

  const sheetLines: { rawLabel: string; code: number; amount: number; section: AccountType | null }[] = []
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
    sheetLines.push({ rawLabel, code, amount, section })
  }

  // A code whose sub-accounts ALSO carry their own balance rows in this sheet is a rollup (e.g.
  // 1110 العملاء = 11102 + 11105, 2101 الموردون = 21011 + 21013 + ...) — posting both would count the
  // same money twice, so only the sub-accounts are posted, regardless of row order. When the rollup
  // equals its sub-accounts' sum it's just a subtotal and needs no warning; only a real mismatch in
  // the file is flagged. A parent whose sub-accounts have no rows here keeps its own balance.
  const rollupCodes = new Set(
    sheetLines
      .filter(l => sheetLines.some(o => o.code !== l.code && isDescendantOf(o.code, l.code, accountsByCode)))
      .map(l => l.code)
  )

  for (const { rawLabel, code, amount, section } of sheetLines) {
    if (rollupCodes.has(code)) {
      const subTotal = sheetLines
        .filter(o => !rollupCodes.has(o.code) && isDescendantOf(o.code, code, accountsByCode))
        .reduce((s, o) => s + o.amount, 0)
      if (Math.abs(subTotal - amount) > 0.01) {
        errors.push(`رصيد الحساب الرئيسي "${rawLabel}" (كود ${code}) = ${amount.toLocaleString('ar-EG')} لا يساوي مجموع حساباته الفرعية في الملف = ${subTotal.toLocaleString('ar-EG')} — تم احتساب الحسابات الفرعية فقط`)
      }
      continue
    }

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
