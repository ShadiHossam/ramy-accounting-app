import * as XLSX from 'xlsx'
import { Account, AccountType, JournalLine } from './types'

const ACCOUNT_TYPES: AccountType[] = ['أصول', 'خصوم', 'حقوق ملكية', 'إيرادات', 'مصروفات']

export interface ParsedAccount extends Account {}
export interface ParsedJournalLine extends Omit<JournalLine, 'id'> {}

export interface ParseResult {
  accounts: ParsedAccount[]
  entries: ParsedJournalLine[]
  errors: string[]
  // True when the same workbook also carries a "قائمة المركز المالى" sheet, so it can double as the
  // opening-balance file (one-workbook upload).
  hasOpeningSheet?: boolean
}

function findOpeningSheetName(names: string[]): string | undefined {
  return names.find(n => stripTatweel(n) === 'قائمة المركز المالى')
    ?? names.find(n => stripTatweel(n).startsWith('قائمة المركز'))
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

function firstCol(hmap: Map<string, number>, ...names: string[]): number | undefined {
  for (const n of names) {
    const c = hmap.get(n)
    if (c !== undefined) return c
  }
  return undefined
}

function asCode(v: unknown): number | null {
  if (isNum(v)) return v
  if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) return Number(v)
  return null
}

// The newer chart layout marks each row only as Group/Account (no أصول/خصوم column), so the
// account's type comes from the root of its tree — by the root's own name, falling back to the
// standard chart-of-accounts leading digit (1 أصول · 2 خصوم · 3 حقوق ملكية · 4 إيرادات · 5 مصروفات).
function inferTypeFromRoot(code: number, name: string): AccountType | null {
  const n = stripTatweel(name)
  if (n.includes('حقوق')) return 'حقوق ملكية'
  if (n.includes('أصول') || n.includes('اصول')) return 'أصول'
  if (n.includes('خصوم') || n.includes('التزامات')) return 'خصوم'
  if (n.includes('إيراد') || n.includes('ايراد')) return 'إيرادات'
  if (n.includes('مصروف') || n.includes('تكاليف')) return 'مصروفات'
  const byDigit: Record<string, AccountType> = { '1': 'أصول', '2': 'خصوم', '3': 'حقوق ملكية', '4': 'إيرادات', '5': 'مصروفات' }
  return byDigit[String(code)[0]] ?? null
}

const CHART_CODE_HEADERS = ['كود الحساب', 'الكود المقترح', 'الكود', 'رقم الحساب']

function isGroupMarker(v: unknown): boolean {
  return /^(group|account)$/i.test(String(v ?? '').trim())
}

// Two chart layouts are accepted:
//   old: كود الحساب | اسم الحساب | نوع الحساب (أصول/خصوم/…) | الحساب الرئيسي | المستوى | الحالة
//   new: كود الحساب | اسم الحساب | النوع (Group/Account) | كود الأب
// In the new one the tree is fully explicit via كود الأب, so level and type are derived from it.
function parseAccounts(ws: XLSX.WorkSheet, errors: string[]): ParsedAccount[] {
  const rows = sheetRows(ws)
  // The code column has been renamed in the client's own files (e.g. "الكود المقترح"), so the
  // header row is located by "اسم الحساب" and the code column accepts the known alternatives.
  const header = findHeaderRow(rows, 'اسم الحساب') ?? findHeaderRow(rows, 'كود الحساب')
  if (!header) {
    errors.push('تعذر إيجاد صف رؤوس الأعمدة (اسم الحساب) في شيت "دليل الحسابات"')
    return []
  }
  const { idx: headerIdx, hmap } = header

  const codeCol = firstCol(hmap, ...CHART_CODE_HEADERS)
  const nameCol = hmap.get('اسم الحساب')
  const typeCol = firstCol(hmap, 'نوع الحساب', 'النوع')
  const parentCol = firstCol(hmap, 'الحساب الرئيسي', 'كود الأب', 'كود الاب', 'كود الحساب الأب', 'كود الحساب الاب')
  const levelCol = hmap.get('المستوى')
  if (codeCol === undefined || nameCol === undefined || typeCol === undefined) {
    errors.push('أعمدة أساسية مفقودة في شيت "دليل الحسابات" (كود الحساب / اسم الحساب / نوع الحساب أو النوع) — تأكد من عدم إعادة تسميتها')
    return []
  }

  const accounts: ParsedAccount[] = []
  const untyped = new Set<number>()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const code = asCode(row?.[codeCol])
    if (code === null) continue

    const rawType = row?.[typeCol]
    const typeText = String(rawType ?? '').trim() as AccountType
    let type: AccountType | null = null
    if (ACCOUNT_TYPES.includes(typeText)) type = typeText
    else if (!isGroupMarker(rawType)) {
      errors.push(`الحساب ${code} له نوع غير معروف: "${rawType}" — تم تجاهله`)
      continue
    }

    const parentCode = parentCol !== undefined ? asCode(row?.[parentCol]) : null

    if (type === null) untyped.add(code)
    accounts.push({
      code,
      name: String(row?.[nameCol] ?? '').trim(),
      type: (type ?? 'أصول') as AccountType,
      parentCode: parentCode === code ? null : parentCode,
      level: levelCol !== undefined && isNum(row?.[levelCol]) ? row[levelCol] : 0,
    })
  }

  const byCode = new Map(accounts.map(a => [a.code, a]))
  const rootOf = (acc: ParsedAccount): ParsedAccount => {
    let cur = acc
    for (let guard = 0; cur.parentCode !== null && byCode.has(cur.parentCode) && guard < 20; guard++) cur = byCode.get(cur.parentCode)!
    return cur
  }

  for (const acc of accounts) {
    if (acc.parentCode !== null && !byCode.has(acc.parentCode)) {
      errors.push(`الحساب ${acc.code} "${acc.name}": كود الأب ${acc.parentCode} غير موجود في دليل الحسابات — تم اعتباره حساباً رئيسياً`)
      acc.parentCode = null
    }
  }
  for (const acc of accounts) {
    if (!untyped.has(acc.code)) continue
    const root = rootOf(acc)
    const type = inferTypeFromRoot(root.code, root.name)
    if (!type) {
      errors.push(`تعذر تحديد نوع الحساب ${acc.code} "${acc.name}" من الحساب الرئيسي "${root.name}" — تم تجاهله`)
      continue
    }
    acc.type = type
  }
  const typed = accounts.filter(a => !untyped.has(a.code) || inferTypeFromRoot(rootOf(a).code, rootOf(a).name))

  // Old charts carry an explicit المستوى; the new layout doesn't, so depth comes from the parent chain.
  for (const acc of typed) {
    if (acc.level > 0) continue
    let level = 1
    let cur: ParsedAccount | undefined = acc
    for (let guard = 0; cur && cur.parentCode !== null && guard < 20; guard++) {
      level++
      cur = byCode.get(cur.parentCode)
    }
    acc.level = level
  }

  resolveHierarchyByCode(typed)
  return typed
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
    refNumber: firstCol(hmap, 'رقم المرجع', 'المرجع'),
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
): { extraAccounts: ParsedAccount[]; lines: { accountCode: number; amount: number }[]; openingDate: Date | null } {
  const rows = sheetRows(ws)

  const table = findHeaderRow(rows, 'كود الحساب')
  if (table && [...table.hmap.keys()].some(k => k.startsWith('الرصيد'))) {
    return parseOpeningBalanceTable(rows, table, accountsByCode, errors)
  }

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
    return { extraAccounts: [], lines: [], openingDate: null }
  }
  // Old layout: the title date is the START of the period ("قائمة المركز المالى فى 1-8-2026"),
  // so the opening entry sits the day before it.
  const openingDate = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate() - 1)

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

  return { extraAccounts, lines, openingDate }
}

// New layout — the balance sheet is the chart of accounts itself with a balance column:
//   كود الحساب | اسم الحساب | نوع الحساب (Group/Account) | كود الحساب الأب | الرصيد في 31-08-2026
// Only Account rows are posted; Group rows are the sheet's own subtotals and are only used to
// cross-check (a mismatch is reported, never corrected). The header date is the END-of-day balance,
// so the opening entry carries that exact date (the journal starts the next day).
function parseOpeningBalanceTable(
  rows: unknown[][],
  { idx: headerIdx, hmap }: { idx: number; hmap: Map<string, number> },
  accountsByCode: Map<number, ParsedAccount>,
  errors: string[]
): { extraAccounts: ParsedAccount[]; lines: { accountCode: number; amount: number }[]; openingDate: Date | null } {
  const codeCol = hmap.get('كود الحساب')!
  const nameCol = hmap.get('اسم الحساب')
  const typeCol = firstCol(hmap, 'نوع الحساب', 'النوع')
  const parentCol = firstCol(hmap, 'كود الحساب الأب', 'كود الحساب الاب', 'كود الأب', 'كود الاب', 'الحساب الرئيسي')
  const balanceKey = [...hmap.keys()].find(k => k.startsWith('الرصيد'))!
  const amountCol = hmap.get(balanceKey)!

  const m = balanceKey.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/) ?? balanceKey.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!m) {
    errors.push(`تعذر قراءة التاريخ من عمود "${balanceKey}" في شيت الرصيد الافتتاحي — تم تجاهل الملف`)
    return { extraAccounts: [], lines: [], openingDate: null }
  }
  const openingDate = m[1].length === 4
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))

  const extraAccounts: ParsedAccount[] = []
  const lines: { accountCode: number; amount: number }[] = []
  const groups: { code: number; name: string; amount: number }[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const code = asCode(row?.[codeCol])
    if (code === null) continue
    const name = nameCol !== undefined ? String(row?.[nameCol] ?? '').trim() : String(code)
    const amount = row?.[amountCol]
    const isGroup = typeCol !== undefined && /^group$/i.test(String(row?.[typeCol] ?? '').trim())

    if (isGroup) {
      if (isNum(amount)) groups.push({ code, name, amount })
      continue
    }
    if (!isNum(amount) || Math.abs(amount) < 0.005) continue

    let account = accountsByCode.get(code)
    if (!account) {
      const declaredParent = parentCol !== undefined ? asCode(row?.[parentCol]) : null
      const parent = declaredParent !== null && declaredParent !== code ? accountsByCode.get(declaredParent) : undefined
      const type = parent?.type ?? inferTypeFromRoot(code, '')
      if (!type) {
        errors.push(`تعذر تصنيف الحساب "${name}" (كود ${code}) في الرصيد الافتتاحي — تم تجاهله`)
        continue
      }
      const root = Array.from(accountsByCode.values()).find(a => a.level === 1 && a.type === type)
      const parentAcc = parent ?? root
      account = { code, name, type, parentCode: parentAcc ? parentAcc.code : null, level: parentAcc ? parentAcc.level + 1 : 1 }
      accountsByCode.set(code, account)
      extraAccounts.push(account)
      errors.push(`الحساب "${name}" (كود ${code}) غير موجود في دليل الحسابات — تمت إضافته تلقائياً تحت "${parentAcc?.name ?? '-'}" برصيد افتتاحي ${amount.toLocaleString('ar-EG')}`)
    }
    lines.push({ accountCode: code, amount })
  }

  // Cross-check every Group subtotal in the sheet against the Account rows beneath it in the chart.
  for (const g of groups) {
    if (!accountsByCode.has(g.code)) continue
    const sum = lines
      .filter(l => isDescendantOf(l.accountCode, g.code, accountsByCode))
      .reduce((s, l) => s + l.amount, 0)
    if (Math.abs(sum - g.amount) > 0.01) {
      errors.push(`مجموع "${g.name}" (كود ${g.code}) في الملف = ${g.amount.toLocaleString('ar-EG')} لا يساوي مجموع حساباته = ${sum.toLocaleString('ar-EG')} — تم احتساب الحسابات فقط`)
    }
  }

  return { extraAccounts, lines, openingDate }
}

function readOpeningFromWorkbook(wb: XLSX.WorkBook, existingAccounts: ParsedAccount[], sheetName: string | undefined): OpeningBalanceResult {
  const errors: string[] = []
  const accountsByCode = new Map(existingAccounts.map(a => [a.code, a]))
  const bsWs = sheetName ? wb.Sheets[sheetName] : undefined
  if (!bsWs) {
    errors.push('لم يتم العثور على شيت "قائمة المركز المالى" في ملف الرصيد الافتتاحي')
    return { extraAccounts: [], openingLines: [], errors }
  }

  const { extraAccounts, lines, openingDate } = parseOpeningBalance(bsWs, accountsByCode, errors)
  if (!openingDate || lines.length === 0) return { extraAccounts, openingLines: [], errors }

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

  return { extraAccounts, openingLines, errors }
}

// Exact name only: workbooks also carry snapshot sheets like "قائمة المركز المالى 30 سبتمبر"
// that must not be mistaken for the opening balance.
const exactOpeningSheet = (names: string[]) => names.find(n => stripTatweel(n).trim() === 'قائمة المركز المالى')

function readJournalWorkbook(wb: XLSX.WorkBook): ParseResult {
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

  return { accounts, entries, errors, hasOpeningSheet: !!exactOpeningSheet(wb.SheetNames) }
}

function readFileAsWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = (e) => {
      try {
        resolve(XLSX.read(e.target?.result, { type: 'array', cellDates: true }))
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// Turns a "قائمة المركز المالى" workbook into: (a) any account codes it uses that aren't in the
// main دليل الحسابات yet, and (b) one opening journal entry (entry #0), so it sits chronologically
// before every real transaction and its balances simply accumulate into whatever those
// transactions add on top.
export async function parseOpeningBalanceFile(file: File, existingAccounts: ParsedAccount[]): Promise<OpeningBalanceResult> {
  try {
    const wb = await readFileAsWorkbook(file)
    const name = findOpeningSheetName(wb.SheetNames) ?? (wb.SheetNames.length === 1 ? wb.SheetNames[0] : undefined)
    return readOpeningFromWorkbook(wb, existingAccounts, name)
  } catch (err) {
    return { extraAccounts: [], openingLines: [], errors: [err instanceof Error && err.message === 'read failed' ? 'فشل في قراءة ملف الرصيد الافتتاحي' : String(err)] }
  }
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  try {
    return readJournalWorkbook(await readFileAsWorkbook(file))
  } catch (err) {
    return { accounts: [], entries: [], errors: [err instanceof Error && err.message === 'read failed' ? 'فشل في قراءة الملف. تأكد من أن الملف غير تالف وحاول مرة أخرى' : String(err)] }
  }
}

// Server-side entry point (Google Sheet sync): one workbook carrying the chart, the journal and,
// optionally, an exact "قائمة المركز المالى" opening-balance sheet.
export function parseLedgerWorkbook(data: ArrayBuffer | Uint8Array): ParseResult & { openingLines: number } {
  const wb = XLSX.read(data, { type: 'array', cellDates: true })
  const journal = readJournalWorkbook(wb)
  if (!journal.hasOpeningSheet || journal.accounts.length === 0) return { ...journal, openingLines: 0 }
  const opening = readOpeningFromWorkbook(wb, journal.accounts, exactOpeningSheet(wb.SheetNames))
  return {
    accounts: [...journal.accounts, ...opening.extraAccounts],
    entries: [...opening.openingLines, ...journal.entries],
    errors: [...journal.errors, ...opening.errors],
    hasOpeningSheet: true,
    openingLines: opening.openingLines.length,
  }
}
