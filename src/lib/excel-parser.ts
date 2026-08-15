import * as XLSX from 'xlsx'
import { BalanceSheetSection, SheetName } from './types'

export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

export interface ParsedMetric {
  sheet: SheetName
  category: string
  month: number // 1-12
  amount: number
}

export interface ParsedBalanceLine {
  label: string
  code: string | null
  section: BalanceSheetSection
  isTotal: boolean
  amount: number
}

export interface ParseResult {
  metrics: ParsedMetric[]
  balanceSheet: ParsedBalanceLine[]
  asOfDate: Date | null
  errors: string[]
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v)
}

function monthIndex(label: unknown): number {
  return ARABIC_MONTHS.indexOf(String(label ?? '').trim())
}

function stripTatweel(s: string): string {
  return s.replace(/ـ/g, '').trim()
}

function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
}

// One month-name column ('الشهر') followed by N category value columns, ending with a
// derivable 'الاجمالي' column we don't need to store. Used for the "مصروفات" sheet.
function parseExpensesSheet(ws: XLSX.WorkSheet, errors: string[]): ParsedMetric[] {
  const rows = sheetRows(ws)
  const headerIdx = rows.findIndex(r => String(r?.[0] ?? '').trim() === 'الشهر')
  if (headerIdx === -1) {
    errors.push('تعذر إيجاد صف رؤوس الأعمدة (الشهر) في شيت "مصروفات"')
    return []
  }
  const header = rows[headerIdx] as unknown[]
  const categories = header
    .slice(1)
    .map(c => String(c ?? '').trim())
    .filter(c => c && c !== 'الاجمالي')

  const metrics: ParsedMetric[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row) continue
    const mi = monthIndex(row[0])
    if (mi === -1) continue // totals row, blank row, #REF! row, etc.
    for (let c = 0; c < categories.length; c++) {
      const val = row[c + 1]
      if (isNum(val)) metrics.push({ sheet: 'مصروفات', category: categories[c], month: mi + 1, amount: val })
    }
  }
  return metrics
}

// Repeating label/value column-pairs across one header row (مشتريات | | | الطباعة | | | ...).
// A cell only becomes a metric when its own column's "month" cell matches a known month name,
// which naturally skips the trailing 'الاجمالي' / notes rows without needing to locate them.
function parseSheet2(ws: XLSX.WorkSheet, errors: string[]): ParsedMetric[] {
  const rows = sheetRows(ws)
  if (rows.length === 0) {
    errors.push('شيت "ورقة2" فارغ')
    return []
  }
  const header = rows[0] as unknown[]
  const categoryCols: { idx: number; category: string }[] = []
  header.forEach((c, idx) => {
    const label = String(c ?? '').trim()
    if (label) categoryCols.push({ idx, category: label })
  })

  const metrics: ParsedMetric[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row) continue
    for (const { idx, category } of categoryCols) {
      const mi = monthIndex(row[idx])
      if (mi === -1) continue
      const val = row[idx + 1]
      if (isNum(val)) metrics.push({ sheet: 'ورقة2', category, month: mi + 1, amount: val })
    }
  }
  return metrics
}

// Two-row merged header with a fixed column layout (verified against the source workbook).
// Detecting data rows by "col 0 is a known month name" makes this robust to blank leading
// rows and the trailing yearly-total rows below the month grid.
const INCOME_COLUMNS: { idx: number; category: string }[] = [
  { idx: 1, category: 'عدد القطع' },
  { idx: 2, category: 'متوسط تكلفة القطعة' },
  { idx: 3, category: 'مبيعات عامة' },
  { idx: 4, category: 'تكلفة المبيعات المباعة' },
  { idx: 5, category: 'مبيعات المحل' },
  { idx: 6, category: 'اجمالى المصروفات' },
  { idx: 7, category: 'صافى ربح الشهر' },
  { idx: 8, category: 'نسبة تكلفة المبيعات العامة' },
  { idx: 11, category: 'اجمالى التحصيلات يوزين' },
  { idx: 12, category: 'التحصيلات الفعلية' },
  { idx: 13, category: 'الفرق' },
]

function parseIncomeSheet(ws: XLSX.WorkSheet, errors: string[]): ParsedMetric[] {
  const rows = sheetRows(ws)
  const headerIdx = rows.findIndex(r => String(r?.[0] ?? '').trim() === 'الشهر')
  if (headerIdx === -1) {
    errors.push('تعذر إيجاد صف رؤوس الأعمدة (الشهر) في شيت "دخل"')
  }
  const sub = headerIdx !== -1 ? (rows[headerIdx + 1] as unknown[]) : []
  if (String(sub?.[3] ?? '').trim() !== 'اجمالى التحصيلات' || String(rows[headerIdx]?.[7] ?? '').trim() !== 'صافى ربح الشهر') {
    errors.push('تحذير: تخطيط أعمدة شيت "دخل" يبدو مختلفاً عن المتوقع — تحقق من الأرقام بعد الاستيراد')
  }

  const metrics: ParsedMetric[] = []
  for (const row of rows) {
    if (!row) continue
    const mi = monthIndex(row[0])
    if (mi === -1) continue
    for (const { idx, category } of INCOME_COLUMNS) {
      const val = row[idx]
      if (isNum(val)) metrics.push({ sheet: 'دخل', category, month: mi + 1, amount: val })
    }
  }
  return metrics
}

// البيان (label) | كود الحساب (code) | المبلغ (amount) — column 2 is always the amount;
// rows with no amount are section headers/subsection markers, used only to track which
// section (assets/liabilities/equity) subsequent amount rows belong to.
function parseBalanceSheet(ws: XLSX.WorkSheet, errors: string[]): { lines: ParsedBalanceLine[]; asOfDate: Date | null } {
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
    errors.push('تعذر إيجاد تاريخ "قائمة المركز المالى" في عنوان الشيت — تم استخدام تاريخ اليوم')
    asOfDate = new Date()
  }

  const lines: ParsedBalanceLine[] = []
  let section: BalanceSheetSection = 'assets'
  for (const row of rows) {
    const rawLabel = String(row?.[0] ?? '').trim()
    if (!rawLabel) continue
    const label = stripTatweel(rawLabel)
    const isTotal = /مجموع|محموع|اجمالى|اجمالي/.test(label)

    // Total/subtotal rows (e.g. the final "إجمالي الالتزامات وحقوق الملكية" combined row,
    // which contains both keywords) summarize the current section rather than starting a
    // new one, so they must not redirect the section tracker.
    if (!isTotal) {
      if (label.includes('حقوق الملكية')) section = 'equity'
      else if (label.includes('الالتزامات')) section = 'liabilities'
      else if (label === 'الاصول') section = 'assets'
    }

    const amount = row?.[2]
    if (!isNum(amount)) continue // section header / not-yet-filled line — no amount to record

    const rawCode = row?.[1]
    const code = rawCode !== null && rawCode !== undefined && rawCode !== '' ? String(rawCode) : null

    lines.push({ label: rawLabel, code, section, isTotal, amount })
  }
  return { lines, asOfDate }
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => {
      resolve({ metrics: [], balanceSheet: [], asOfDate: null, errors: ['فشل في قراءة الملف. تأكد من أن الملف غير تالف وحاول مرة أخرى'] })
    }
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const errors: string[] = []
        const metrics: ParsedMetric[] = []
        let balanceSheet: ParsedBalanceLine[] = []
        let asOfDate: Date | null = null

        const expensesWs = wb.Sheets['مصروفات']
        if (expensesWs) metrics.push(...parseExpensesSheet(expensesWs, errors))
        else errors.push('لم يتم العثور على شيت "مصروفات" في الملف')

        const sheet2Ws = wb.Sheets['ورقة2']
        if (sheet2Ws) metrics.push(...parseSheet2(sheet2Ws, errors))
        else errors.push('لم يتم العثور على شيت "ورقة2" في الملف')

        const incomeWs = wb.Sheets['دخل']
        if (incomeWs) metrics.push(...parseIncomeSheet(incomeWs, errors))
        else errors.push('لم يتم العثور على شيت "دخل" في الملف')

        const bsWs = wb.Sheets['قائمة المركز المالى']
        if (bsWs) {
          const r = parseBalanceSheet(bsWs, errors)
          balanceSheet = r.lines
          asOfDate = r.asOfDate
        } else {
          errors.push('لم يتم العثور على شيت "قائمة المركز المالى" في الملف')
        }

        if (metrics.length === 0 && balanceSheet.length === 0) {
          errors.push('لم يتم العثور على بيانات صالحة في الملف')
        }

        resolve({ metrics, balanceSheet, asOfDate, errors })
      } catch (err) {
        resolve({ metrics: [], balanceSheet: [], asOfDate: null, errors: [String(err)] })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
