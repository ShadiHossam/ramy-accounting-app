import {
  JournalLine, Account, AccountType, FinancialSummary, MonthlyData, CategoryBreakdown,
  PeriodFilter, BalanceSheetLine, BalanceSheetSection,
} from './types'

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

// Standard double-entry net movement for an account, based on its type's normal balance side —
// أصول/مصروفات are debit-normal, خصوم/حقوق ملكية/إيرادات are credit-normal. This is the one and
// only formula used anywhere in this file; there is no per-category judgment call layered on top.
function netMovement(type: AccountType, debit: number, credit: number): number {
  return (type === 'أصول' || type === 'مصروفات') ? debit - credit : credit - debit
}

function sumByType(entries: JournalLine[], type: AccountType): number {
  return entries.filter(e => e.accountType === type).reduce((s, e) => s + netMovement(type, e.debit, e.credit), 0)
}

export function filterByPeriod(entries: JournalLine[], period: PeriodFilter): JournalLine[] {
  return entries.filter(e => e.entryDate >= period.startDate && e.entryDate <= period.endDate)
}

export function calcMonthlyData(entries: JournalLine[]): MonthlyData[] {
  // MonthlyData is a P&L-only view (revenue/expenses/netProfit) — a month with only
  // balance-sheet-only activity (e.g. an opening-balance entry that just sets up asset/equity
  // accounts) has nothing to show here and shouldn't appear as a phantom all-zero row.
  const plEntries = entries.filter(e => e.accountType === 'إيرادات' || e.accountType === 'مصروفات')
  const keys = new Set(plEntries.map(e => monthKey(e.entryDate)))

  const result: MonthlyData[] = Array.from(keys).map(key => {
    const [yearStr, monthStr] = key.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const inMonth = entries.filter(e => monthKey(e.entryDate) === key)
    const revenue = sumByType(inMonth, 'إيرادات')
    const expenses = sumByType(inMonth, 'مصروفات')

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      label: `${ARABIC_MONTHS[month - 1]} ${year}`,
      revenue, expenses, netProfit: revenue - expenses,
    }
  })

  return result.sort((a, b) => a.month.localeCompare(b.month))
}

export function calcSummary(entries: JournalLine[]): FinancialSummary {
  const totalRevenue = sumByType(entries, 'إيرادات')
  const totalExpenses = sumByType(entries, 'مصروفات')
  const netProfit = totalRevenue - totalExpenses
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
  return { totalRevenue, totalExpenses, netProfit, netMargin }
}

// Groups by the account's own literal name from دليل الحسابات — never an invented bucket.
function byAccount(entries: JournalLine[], type: AccountType): CategoryBreakdown[] {
  const relevant = entries.filter(e => e.accountType === type)
  const map = new Map<string, { amount: number; count: number }>()
  for (const e of relevant) {
    const cur = map.get(e.accountName) ?? { amount: 0, count: 0 }
    cur.amount += netMovement(type, e.debit, e.credit)
    cur.count += 1
    map.set(e.accountName, cur)
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v.amount, 0)

  return Array.from(map.entries())
    .filter(([, v]) => v.amount !== 0)
    .map(([name, v]) => ({ name, amount: v.amount, percentage: total > 0 ? (v.amount / total) * 100 : 0, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
}

export function calcRevenueBySource(entries: JournalLine[]): CategoryBreakdown[] {
  return byAccount(entries, 'إيرادات')
}

export function calcExpensesByCategory(entries: JournalLine[]): CategoryBreakdown[] {
  return byAccount(entries, 'مصروفات')
}

// مركز التكلفة is a literal column on every journal line — grouping by it (for expense accounts
// only, since assets/revenue/liabilities/equity touching a cost center aren't "costs") is a
// direct groupby on real data, not an invented dimension.
export function calcCostCenters(entries: JournalLine[]): CategoryBreakdown[] {
  const relevant = entries.filter(e => e.accountType === 'مصروفات' && e.costCenter)
  const map = new Map<string, { amount: number; count: number }>()
  for (const e of relevant) {
    const cur = map.get(e.costCenter) ?? { amount: 0, count: 0 }
    cur.amount += netMovement('مصروفات', e.debit, e.credit)
    cur.count += 1
    map.set(e.costCenter, cur)
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v.amount, 0)

  return Array.from(map.entries())
    .filter(([, v]) => v.amount !== 0)
    .map(([name, v]) => ({ name, amount: v.amount, percentage: total > 0 ? (v.amount / total) * 100 : 0, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
}

// No sales-rep/agent dimension exists in the journal-entry format either — always empty.
export function calcRevenueByAnalytical(_entries?: JournalLine[]): CategoryBreakdown[] {
  return []
}
export function calcExpensesByAnalytical(_entries?: JournalLine[]): CategoryBreakdown[] {
  return []
}

export function calcParetoAnalysis(items: CategoryBreakdown[]): CategoryBreakdown[] {
  const total = items.reduce((s, i) => s + i.amount, 0)
  let cumulative = 0
  return items.map(item => {
    cumulative += item.amount
    return { ...item, percentage: total > 0 ? (cumulative / total) * 100 : 0 }
  })
}

export function calcHorizontalAnalysis(
  current: MonthlyData[],
  previous: MonthlyData[]
): Array<{ label: string; currentRevenue: number; prevRevenue: number; revenueChange: number; revenueChangePct: number; currentExpenses: number; prevExpenses: number; expensesChange: number; currentNetProfit: number; prevNetProfit: number; netProfitChange: number; netProfitChangePct: number }> {
  const prevMap = new Map(previous.map(m => [m.month.slice(5), m]))
  return current.map(m => {
    const p = prevMap.get(m.month.slice(5))
    const prevRevenue = p?.revenue ?? 0
    const prevExpenses = p?.expenses ?? 0
    const prevNetProfit = p?.netProfit ?? 0
    return {
      label: m.label,
      currentRevenue: m.revenue,
      prevRevenue,
      revenueChange: m.revenue - prevRevenue,
      revenueChangePct: prevRevenue > 0 ? ((m.revenue - prevRevenue) / prevRevenue) * 100 : 0,
      currentExpenses: m.expenses,
      prevExpenses,
      expensesChange: m.expenses - prevExpenses,
      currentNetProfit: m.netProfit,
      prevNetProfit,
      netProfitChange: m.netProfit - prevNetProfit,
      netProfitChangePct: prevNetProfit !== 0 ? ((m.netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : 0,
    }
  })
}

// Builds the balance sheet strictly from دليل الحسابات's own hierarchy (level/parentCode) and
// each account's running balance up to asOfDate — group/root labels and subtotal groupings are
// the source file's own account-tree structure, not an invented classification.
export function calcBalanceSheet(entries: JournalLine[], accounts: Account[], asOfDate: Date): BalanceSheetLine[] {
  const upTo = entries.filter(e => e.entryDate <= asOfDate)
  const byCode = new Map<number, number>()
  for (const e of upTo) {
    const account = accounts.find(a => a.code === e.accountCode)
    if (!account) continue
    byCode.set(account.code, (byCode.get(account.code) ?? 0) + netMovement(account.type, e.debit, e.credit))
  }

  const lines: BalanceSheetLine[] = []
  const rootTypes: { type: AccountType; section: BalanceSheetSection }[] = [
    { type: 'أصول', section: 'assets' },
    { type: 'خصوم', section: 'liabilities' },
    { type: 'حقوق ملكية', section: 'equity' },
  ]

  const rootTotals: Partial<Record<BalanceSheetSection, number>> = {}

  for (const { type, section } of rootTypes) {
    const root = accounts.find(a => a.level === 1 && a.type === type)
    if (!root) continue

    const level2 = accounts.filter(a => a.parentCode === root.code).sort((a, b) => a.code - b.code)
    let rootTotal = 0

    for (const group of level2) {
      const leaves = accounts.filter(a => a.parentCode === group.code).sort((a, b) => a.code - b.code)

      if (leaves.length === 0) {
        // The group itself has no children — it's a leaf account (e.g. equity accounts sit
        // directly under the root with no intermediate grouping level).
        const amount = byCode.get(group.code) ?? 0
        lines.push({ id: `acct-${group.code}`, label: group.name, code: String(group.code), section, isTotal: false, amount, asOfDate })
        rootTotal += amount
      } else {
        let groupTotal = 0
        for (const leaf of leaves) {
          const amount = byCode.get(leaf.code) ?? 0
          lines.push({ id: `acct-${leaf.code}`, label: leaf.name, code: String(leaf.code), section, isTotal: false, amount, asOfDate })
          groupTotal += amount
        }
        lines.push({ id: `grp-${group.code}`, label: `مجموع ${group.name}`, code: String(group.code), section, isTotal: true, amount: groupTotal, asOfDate })
        rootTotal += groupTotal
      }
    }

    // Standard interim-reporting convention: current-period net income sits in equity until a
    // formal closing entry moves it into retained earnings. Without this line the balance sheet
    // would show a real (not invented) gap of exactly Revenue-Expenses for the period, since the
    // ledger itself hasn't posted that closing entry yet. The figure is the same non-discretionary
    // Revenue-Expenses formula used everywhere else — not a new judgment call.
    if (type === 'حقوق ملكية') {
      const periodProfit = sumByType(upTo, 'إيرادات') - sumByType(upTo, 'مصروفات')
      lines.push({ id: 'equity-period-profit', label: 'أرباح (خسائر) الفترة الحالية — غير مُقفلة', code: null, section, isTotal: false, amount: periodProfit, asOfDate })
      rootTotal += periodProfit
    }

    lines.push({ id: `root-${root.code}`, label: `إجمالي ${root.name}`, code: String(root.code), section, isTotal: true, amount: rootTotal, asOfDate })
    rootTotals[section] = rootTotal
  }

  const combined = (rootTotals.liabilities ?? 0) + (rootTotals.equity ?? 0)
  lines.push({ id: 'combined-liab-equity', label: 'إجمالي الالتزامات وحقوق الملكية', code: null, section: 'liabilities', isTotal: true, amount: combined, asOfDate })

  return lines
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ج.م'
}

export function buildFinancialContext(entries: JournalLine[], period: PeriodFilter): string {
  const filtered = filterByPeriod(entries, period)
  const summary = calcSummary(filtered)
  const monthly = calcMonthlyData(filtered)
  const revSources = calcRevenueBySource(filtered).slice(0, 15)
  const expCats = calcExpensesByCategory(filtered).slice(0, 15)
  const costCenters = calcCostCenters(filtered).slice(0, 10)

  const bestMonth = monthly.reduce((best, m) => m.netProfit > best.netProfit ? m : best, monthly[0] ?? { label: '-', netProfit: 0 })
  const worstMonth = monthly.reduce((worst, m) => m.netProfit < worst.netProfit ? m : worst, monthly[0] ?? { label: '-', netProfit: 0 })

  const expenseRatio = summary.totalRevenue > 0 ? (summary.totalExpenses / summary.totalRevenue * 100).toFixed(1) : '0'
  const profitableMonths = monthly.filter(m => m.netProfit > 0).length
  const lossMonths = monthly.filter(m => m.netProfit < 0).length

  const topSourceName = revSources.length > 0 ? revSources[0].name : '-'
  const topSourcePct = revSources.length > 0 ? revSources[0].percentage.toFixed(1) : '0'

  const monthlyDetail = monthly.map(m =>
    `${m.label}: إيرادات ${formatCurrency(m.revenue)} | مصروفات ${formatCurrency(m.expenses)} | صافي ${formatCurrency(m.netProfit)}`
  ).join('\n')

  return `
البيانات المالية للفترة: ${period.label}
====================================
هذه الأرقام مُجمّعة مباشرة من دفتر اليومية (قيود اليومية) بالحساب المحاسبي المعتاد
(مدين/دائن حسب نوع كل حساب) — بدون أي تصنيف أو تقدير إضافي.

## ملخص قائمة الدخل
إجمالي الإيرادات: ${formatCurrency(summary.totalRevenue)}
إجمالي المصروفات: ${formatCurrency(summary.totalExpenses)} (${expenseRatio}% من الإيرادات)
صافي الربح: ${formatCurrency(summary.netProfit)} | هامش صافي الربح: ${summary.netMargin.toFixed(1)}%

## الإيرادات حسب الحساب
${revSources.map((s, i) => `${i + 1}. ${s.name}: ${formatCurrency(s.amount)} (${s.percentage.toFixed(1)}%)`).join('\n')}
المصدر الأول "${topSourceName}" يمثل ${topSourcePct}% من إجمالي الإيرادات

## المصروفات حسب الحساب
${expCats.map((e, i) => `${i + 1}. ${e.name}: ${formatCurrency(e.amount)} (${e.percentage.toFixed(1)}%)`).join('\n')}

## حسب مركز التكلفة
${costCenters.length > 0 ? costCenters.map((c, i) => `${i + 1}. ${c.name}: ${formatCurrency(c.amount)} (${c.percentage.toFixed(1)}%)`).join('\n') : 'لا يوجد أكثر من مركز تكلفة واحد في البيانات'}

## الأداء الشهري
${monthlyDetail}

## ملخص الأداء
- إجمالي الأشهر: ${monthly.length} | مربحة: ${profitableMonths} | خاسرة: ${lossMonths}
- أفضل شهر: ${bestMonth.label} (${formatCurrency(bestMonth.netProfit)})
- أسوأ شهر: ${worstMonth.label} (${formatCurrency(worstMonth.netProfit)})
`
}
