import { MonthlyMetric, FinancialSummary, MonthlyData, CategoryBreakdown, PeriodFilter, SheetName } from './types'

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

// Expense categories available in the monthly-summary workbook, mapped to the sheet each
// lives on and to the P&L bucket used by calcSummary/income-statement — see the plan's
// "Category → P&L-bucket mapping" note: this is a judgment call (اعلانات → selling,
// مرتبات+الايجار+عمومية → admin, the rest → operating), not something the source file states.
const EXPENSE_CATEGORY_SHEET: Record<string, SheetName> = {
  'مرتبات': 'مصروفات', 'الايجار': 'مصروفات', 'اعلانات': 'مصروفات', 'عمومية': 'مصروفات',
  'الطباعة': 'ورقة2', 'مصروفات مصنعيات': 'ورقة2', 'تطريز': 'ورقة2', 'مصروفات تشغيل': 'ورقة2',
}
const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_SHEET)
const SELLING_CATEGORIES = ['اعلانات']
const ADMIN_CATEGORIES = ['مرتبات', 'الايجار', 'عمومية']
const OPERATING_CATEGORIES = ['مصروفات تشغيل', 'مصروفات مصنعيات', 'الطباعة', 'تطريز']

function sumCategory(metrics: MonthlyMetric[], sheet: SheetName, category: string): number {
  return metrics.filter(m => m.sheet === sheet && m.category === category).reduce((s, m) => s + m.amount, 0)
}

function sumCategories(metrics: MonthlyMetric[], categories: string[]): number {
  return categories.reduce((s, cat) => s + sumCategory(metrics, EXPENSE_CATEGORY_SHEET[cat], cat), 0)
}

export function filterByPeriod(metrics: MonthlyMetric[], period: PeriodFilter): MonthlyMetric[] {
  return metrics.filter(m => {
    const d = new Date(m.year, m.month - 1, 1)
    return d >= period.startDate && d <= period.endDate
  })
}

export function calcMonthlyData(metrics: MonthlyMetric[]): MonthlyData[] {
  const keys = new Set(metrics.map(m => `${m.year}-${m.month}`))

  const result: MonthlyData[] = Array.from(keys).map(key => {
    const [yearStr, monthStr] = key.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const at = (sheet: SheetName, category: string) =>
      metrics.find(m => m.year === year && m.month === month && m.sheet === sheet && m.category === category)?.amount ?? 0

    const revenue = at('دخل', 'مبيعات عامة') + at('دخل', 'مبيعات المحل')
    const purchases = at('ورقة2', 'مشتريات')
    const expenses = EXPENSE_CATEGORIES.reduce((s, cat) => s + at(EXPENSE_CATEGORY_SHEET[cat], cat), 0)
    const netProfit = at('دخل', 'صافى ربح الشهر')
    const netSales = revenue
    const grossProfit = netSales - purchases

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      label: `${ARABIC_MONTHS[month - 1]} ${year}`,
      revenue, expenses, purchases, salesReturns: 0, netProfit, grossProfit,
      grossMargin: netSales > 0 ? (grossProfit / netSales) * 100 : 0,
      netMargin: netSales > 0 ? (netProfit / netSales) * 100 : 0,
    }
  })

  return result.sort((a, b) => a.month.localeCompare(b.month))
}

export function calcSummary(metrics: MonthlyMetric[]): FinancialSummary {
  const monthly = calcMonthlyData(metrics)

  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0)
  const salesReturns = 0
  const netSales = totalRevenue - salesReturns
  const purchases = monthly.reduce((s, m) => s + m.purchases, 0)
  const grossProfit = netSales - purchases
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0

  const sellingExpenses = sumCategories(metrics, SELLING_CATEGORIES)
  const adminExpenses = sumCategories(metrics, ADMIN_CATEGORIES)
  const operatingExpenses = sumCategories(metrics, OPERATING_CATEGORIES)
  const otherExpenses = 0
  const taxExpenses = 0
  const totalExpenses = sellingExpenses + adminExpenses + operatingExpenses + otherExpenses + taxExpenses

  const netProfit = monthly.reduce((s, m) => s + m.netProfit, 0)
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0

  return {
    totalRevenue, salesReturns, netSales, purchases, grossProfit, grossMargin,
    sellingExpenses, adminExpenses, operatingExpenses, otherExpenses, totalExpenses, taxExpenses,
    netProfit, netMargin,
  }
}

export function calcRevenueBySource(metrics: MonthlyMetric[]): CategoryBreakdown[] {
  const sources = [
    { name: 'مبيعات عامة', sheet: 'دخل' as SheetName },
    { name: 'مبيعات المحل', sheet: 'دخل' as SheetName },
  ]
  const amounts = sources.map(s => ({ ...s, amount: sumCategory(metrics, s.sheet, s.name) }))
  const total = amounts.reduce((s, a) => s + a.amount, 0)

  return amounts
    .filter(a => a.amount !== 0)
    .map(a => ({
      name: a.name,
      amount: a.amount,
      percentage: total > 0 ? (a.amount / total) * 100 : 0,
      count: metrics.filter(m => m.sheet === a.sheet && m.category === a.name).length,
    }))
    .sort((a, b) => b.amount - a.amount)
}

// No rep/analytical dimension exists in the monthly-summary workbook — always empty.
export function calcRevenueByAnalytical(_metrics?: MonthlyMetric[]): CategoryBreakdown[] {
  return []
}

export function calcExpensesByCategory(metrics: MonthlyMetric[]): CategoryBreakdown[] {
  const items = EXPENSE_CATEGORIES.map(cat => {
    const sheet = EXPENSE_CATEGORY_SHEET[cat]
    const amount = sumCategory(metrics, sheet, cat)
    const count = metrics.filter(m => m.sheet === sheet && m.category === cat).length
    return { name: cat, amount, count }
  })
  const total = items.reduce((s, i) => s + i.amount, 0)

  return items
    .filter(i => i.count > 0)
    .map(i => ({ ...i, percentage: total > 0 ? (i.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

// No rep/analytical dimension exists in the monthly-summary workbook — always empty.
export function calcExpensesByAnalytical(_metrics?: MonthlyMetric[]): CategoryBreakdown[] {
  return []
}

// No cost-center dimension exists in the monthly-summary workbook — always empty.
export function calcCostCenters(_metrics?: MonthlyMetric[]): CategoryBreakdown[] {
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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ج.م'
}

export function buildFinancialContext(metrics: MonthlyMetric[], period: PeriodFilter): string {
  const filtered = filterByPeriod(metrics, period)
  const summary = calcSummary(filtered)
  const monthly = calcMonthlyData(filtered)
  const revSources = calcRevenueBySource(filtered).slice(0, 10)
  const expCats = calcExpensesByCategory(filtered).slice(0, 10)

  const bestMonth = monthly.reduce((best, m) => m.netProfit > best.netProfit ? m : best, monthly[0] ?? { label: '-', netProfit: 0 })
  const worstMonth = monthly.reduce((worst, m) => m.netProfit < worst.netProfit ? m : worst, monthly[0] ?? { label: '-', netProfit: 0 })

  const expenseRatio = summary.netSales > 0 ? (summary.totalExpenses / summary.netSales * 100).toFixed(1) : '0'
  const sellingRatio = summary.netSales > 0 ? (summary.sellingExpenses / summary.netSales * 100).toFixed(1) : '0'
  const adminRatio = summary.netSales > 0 ? (summary.adminExpenses / summary.netSales * 100).toFixed(1) : '0'
  const purchasesRatio = summary.netSales > 0 ? (summary.purchases / summary.netSales * 100).toFixed(1) : '0'

  const profitableMonths = monthly.filter(m => m.netProfit > 0).length
  const lossMonths = monthly.filter(m => m.netProfit < 0).length

  const topSourceName = revSources.length > 0 ? revSources[0].name : '-'
  const topSourcePct = revSources.length > 0 ? revSources[0].percentage.toFixed(1) : '0'

  const recentMonths = monthly.slice(-4)
  const momGrowth = recentMonths.slice(1).map((m, i) => {
    const prev = recentMonths[i]
    if (!prev || prev.revenue === 0) return `${m.label}: لا يوجد مقارنة`
    const pct = ((m.revenue - prev.revenue) / prev.revenue * 100).toFixed(1)
    return `${m.label}: ${Number(pct) >= 0 ? '+' : ''}${pct}%`
  }).join('، ')

  const monthlyDetail = monthly.map(m => {
    const netSales = m.revenue - m.salesReturns
    return `${m.label}: إيرادات ${formatCurrency(m.revenue)} | مصروفات ${formatCurrency(m.expenses + m.purchases)} | صافي ${formatCurrency(m.netProfit)} | هامش ${netSales > 0 ? (m.netProfit / netSales * 100).toFixed(1) : 0}%`
  }).join('\n')

  return `
البيانات المالية للفترة: ${period.label}
====================================
## ملخص قائمة الدخل
إجمالي الإيرادات: ${formatCurrency(summary.totalRevenue)}
صافي المبيعات: ${formatCurrency(summary.netSales)}
تكلفة المشتريات: ${formatCurrency(summary.purchases)} (${purchasesRatio}% من صافي المبيعات)
مجمل الربح: ${formatCurrency(summary.grossProfit)} | هامش الربح الإجمالي: ${summary.grossMargin.toFixed(1)}%
إجمالي المصروفات التشغيلية: ${formatCurrency(summary.totalExpenses)} (${expenseRatio}% من صافي المبيعات)
صافي الربح: ${formatCurrency(summary.netProfit)} | هامش الربح الصافي: ${summary.netMargin.toFixed(1)}%

## نسب مالية رئيسية
- نسبة المصروفات الكلية / الإيرادات: ${expenseRatio}%
- نسبة مصروفات البيع والتسويق / الإيرادات: ${sellingRatio}%
- نسبة المصروفات الإدارية / الإيرادات: ${adminRatio}%
- نسبة تكلفة المشتريات / الإيرادات: ${purchasesRatio}%

## تركيز الإيرادات
المصدر الأول "${topSourceName}" يمثل ${topSourcePct}% من إجمالي الإيرادات
أعلى مصادر الإيراد:
${revSources.map((s, i) => `${i + 1}. ${s.name}: ${formatCurrency(s.amount)} (${s.percentage.toFixed(1)}%)`).join('\n')}

## توزيع المصروفات
${expCats.map((e, i) => `${i + 1}. ${e.name}: ${formatCurrency(e.amount)} (${e.percentage.toFixed(1)}%)`).join('\n')}

## الأداء الشهري التفصيلي
${monthlyDetail}

## ملخص الأداء
- إجمالي الأشهر: ${monthly.length} | مربحة: ${profitableMonths} | خاسرة: ${lossMonths}
- أفضل شهر: ${bestMonth.label} (${formatCurrency(bestMonth.netProfit)})
- أسوأ شهر: ${worstMonth.label} (${formatCurrency(worstMonth.netProfit)})
- نمو الإيرادات الشهري (آخر فترة): ${momGrowth || 'لا يوجد بيانات كافية'}

ملاحظة: هذا التنسيق لا يحتوي على بيانات تفصيلية لكل مندوب/مركز تكلفة — فقط إجماليات شهرية.
`
}
