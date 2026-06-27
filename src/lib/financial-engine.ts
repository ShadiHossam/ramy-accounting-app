import { Transaction, FinancialSummary, MonthlyData, CategoryBreakdown, PeriodFilter } from './types'

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

export function filterByPeriod(transactions: Transaction[], period: PeriodFilter): Transaction[] {
  return transactions.filter(t => {
    const d = new Date(t.date)
    return d >= period.startDate && d <= period.endDate
  })
}

export function calcSummary(transactions: Transaction[]): FinancialSummary {
  const sum = (account: string) =>
    transactions.filter(t => t.account === account).reduce((s, t) => s + t.amount, 0)

  const sumSub = (account: string, sub: string) =>
    transactions.filter(t => t.account === account && t.subAccount === sub).reduce((s, t) => s + t.amount, 0)

  const totalRevenue = sum('ايرادات')
  const salesReturns = sum('مردودات المبيعات')
  const netSales = totalRevenue - salesReturns
  const purchases = sum('مشتريات')
  const grossProfit = netSales - purchases
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0

  const sellingExpenses = sumSub('مصروفات', 'مصروفات بيعية وتسويقية')
  const adminExpenses = sumSub('مصروفات', 'مصروفات عمومية وادارية')
  const operatingExpenses = sumSub('مصروفات', 'مصروفات التشغيل')
  const taxExpenses = sum('مصلحة الضرائب')
  // Sum ALL مصروفات rows so uncategorized entries are not silently dropped
  const allExpenses = sum('مصروفات')
  const otherExpenses = allExpenses - sellingExpenses - adminExpenses - operatingExpenses
  const totalExpenses = allExpenses + taxExpenses

  const netProfit = grossProfit - totalExpenses
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0
  const fixedAssets = sum('اصول ثابتة')

  return {
    totalRevenue, salesReturns, netSales, purchases, grossProfit, grossMargin,
    sellingExpenses, adminExpenses, operatingExpenses, otherExpenses, totalExpenses, taxExpenses,
    netProfit, netMargin, fixedAssets
  }
}

export function calcMonthlyData(transactions: Transaction[]): MonthlyData[] {
  const map = new Map<string, MonthlyData>()

  for (const t of transactions) {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) {
      map.set(key, {
        month: key,
        label: `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        revenue: 0, expenses: 0, purchases: 0, salesReturns: 0, netProfit: 0, grossProfit: 0, grossMargin: 0, netMargin: 0
      })
    }
    const m = map.get(key)!
    if (t.account === 'ايرادات') m.revenue += t.amount
    else if (t.account === 'مصروفات' || t.account === 'مصلحة الضرائب') m.expenses += t.amount
    else if (t.account === 'مشتريات') m.purchases += t.amount
    else if (t.account === 'مردودات المبيعات') m.salesReturns += t.amount
  }

  const result = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month))
  for (const m of result) {
    const netSales = m.revenue - m.salesReturns
    m.grossProfit = netSales - m.purchases
    m.netProfit = m.grossProfit - m.expenses
    m.grossMargin = netSales > 0 ? (m.grossProfit / netSales) * 100 : 0
    m.netMargin = netSales > 0 ? (m.netProfit / netSales) * 100 : 0
  }
  return result
}

export function calcDailyData(transactions: Transaction[]) {
  const map = new Map<string, { date: string; label: string; revenue: number; expenses: number; purchases: number; salesReturns: number; netProfit: number }>()

  for (const t of transactions) {
    const d = new Date(t.date)
    const key = d.toISOString().slice(0, 10)
    if (!map.has(key)) {
      map.set(key, { date: key, label: key, revenue: 0, expenses: 0, purchases: 0, salesReturns: 0, netProfit: 0 })
    }
    const m = map.get(key)!
    if (t.account === 'ايرادات') m.revenue += t.amount
    else if (t.account === 'مصروفات' || t.account === 'مصلحة الضرائب') m.expenses += t.amount
    else if (t.account === 'مشتريات') m.purchases += t.amount
    else if (t.account === 'مردودات المبيعات') m.salesReturns += t.amount
  }

  const result = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  for (const m of result) m.netProfit = m.revenue - m.salesReturns - m.purchases - m.expenses
  return result
}

export function calcRevenueBySource(transactions: Transaction[]): CategoryBreakdown[] {
  const revenue = transactions.filter(t => t.account === 'ايرادات')
  const total = revenue.reduce((s, t) => s + t.amount, 0)
  const map = new Map<string, number>()

  for (const t of revenue) {
    map.set(t.subAccount, (map.get(t.subAccount) ?? 0) + t.amount)
  }

  return Array.from(map.entries())
    .map(([name, amount]) => ({
      name, amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      count: revenue.filter(t => t.subAccount === name).length
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function calcRevenueByAnalytical(transactions: Transaction[]): CategoryBreakdown[] {
  const revenue = transactions.filter(t => t.account === 'ايرادات' && t.analytical)
  const total = revenue.reduce((s, t) => s + t.amount, 0)
  const map = new Map<string, number>()

  for (const t of revenue) {
    if (t.analytical) map.set(t.analytical, (map.get(t.analytical) ?? 0) + t.amount)
  }

  return Array.from(map.entries())
    .map(([name, amount]) => ({
      name, amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      count: revenue.filter(t => t.analytical === name).length
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function calcExpensesByCategory(transactions: Transaction[]): CategoryBreakdown[] {
  const expenses = transactions.filter(t => t.account === 'مصروفات')
  const taxItems = transactions.filter(t => t.account === 'مصلحة الضرائب')
  const taxTotal = taxItems.reduce((s, t) => s + t.amount, 0)

  const total = expenses.reduce((s, t) => s + t.amount, 0) + taxTotal
  const map = new Map<string, { amount: number; count: number }>()

  for (const t of expenses) {
    const key = t.subAccount || 'أخرى'
    const prev = map.get(key) ?? { amount: 0, count: 0 }
    map.set(key, { amount: prev.amount + t.amount, count: prev.count + 1 })
  }

  if (taxTotal > 0) {
    map.set('ضرائب', { amount: taxTotal, count: taxItems.length })
  }

  return Array.from(map.entries())
    .map(([name, { amount, count }]) => ({
      name, amount, count,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function calcExpensesByAnalytical(transactions: Transaction[]): CategoryBreakdown[] {
  const expenses = transactions.filter(t => t.account === 'مصروفات' && t.analytical)
  const total = expenses.reduce((s, t) => s + t.amount, 0)
  const map = new Map<string, number>()

  for (const t of expenses) {
    if (t.analytical) map.set(t.analytical, (map.get(t.analytical) ?? 0) + t.amount)
  }

  return Array.from(map.entries())
    .map(([name, amount]) => ({
      name, amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      count: expenses.filter(t => t.analytical === name).length
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function calcCostCenters(transactions: Transaction[]): CategoryBreakdown[] {
  const withCC = transactions.filter(t => t.costCenter && t.account === 'مصروفات')
  const total = withCC.reduce((s, t) => s + t.amount, 0)
  const map = new Map<string, number>()

  for (const t of withCC) {
    map.set(t.costCenter, (map.get(t.costCenter) ?? 0) + t.amount)
  }

  return Array.from(map.entries())
    .map(([name, amount]) => ({
      name, amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      count: withCC.filter(t => t.costCenter === name).length
    }))
    .sort((a, b) => b.amount - a.amount)
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

export function buildFinancialContext(transactions: Transaction[], period: PeriodFilter): string {
  const filtered = filterByPeriod(transactions, period)
  const summary = calcSummary(filtered)
  const monthly = calcMonthlyData(filtered)
  const revSources = calcRevenueBySource(filtered).slice(0, 10)
  const expCats = calcExpensesByCategory(filtered).slice(0, 10)
  const topAnalytical = calcRevenueByAnalytical(filtered).slice(0, 10)

  const bestMonth = monthly.reduce((best, m) => m.netProfit > best.netProfit ? m : best, monthly[0] ?? { label: '-', netProfit: 0 })
  const worstMonth = monthly.reduce((worst, m) => m.netProfit < worst.netProfit ? m : worst, monthly[0] ?? { label: '-', netProfit: 0 })

  // Derived ratios
  const expenseRatio = summary.netSales > 0 ? (summary.totalExpenses / summary.netSales * 100).toFixed(1) : '0'
  const sellingRatio = summary.netSales > 0 ? (summary.sellingExpenses / summary.netSales * 100).toFixed(1) : '0'
  const adminRatio = summary.netSales > 0 ? (summary.adminExpenses / summary.netSales * 100).toFixed(1) : '0'
  const purchasesRatio = summary.netSales > 0 ? (summary.purchases / summary.netSales * 100).toFixed(1) : '0'

  const profitableMonths = monthly.filter(m => m.netProfit > 0).length
  const lossMonths = monthly.filter(m => m.netProfit < 0).length

  const topSourceName = revSources.length > 0 ? revSources[0].name : '-'
  const topSourcePct = revSources.length > 0 ? revSources[0].percentage.toFixed(1) : '0'

  // MoM revenue growth for last 3 months
  const recentMonths = monthly.slice(-4)
  const momGrowth = recentMonths.slice(1).map((m, i) => {
    const prev = recentMonths[i]
    if (!prev || prev.revenue === 0) return `${m.label}: لا يوجد مقارنة`
    const pct = ((m.revenue - prev.revenue) / prev.revenue * 100).toFixed(1)
    return `${m.label}: ${Number(pct) >= 0 ? '+' : ''}${pct}%`
  }).join('، ')

  // Months with detailed margin
  const monthlyDetail = monthly.map(m => {
    const netSales = m.revenue - m.salesReturns
    return `${m.label}: إيرادات ${formatCurrency(m.revenue)} | مصروفات ${formatCurrency(m.expenses + m.purchases)} | صافي ${formatCurrency(m.netProfit)} | هامش ${netSales > 0 ? (m.netProfit / netSales * 100).toFixed(1) : 0}%`
  }).join('\n')

  return `
البيانات المالية للفترة: ${period.label}
====================================
## ملخص قائمة الدخل
إجمالي الإيرادات: ${formatCurrency(summary.totalRevenue)}
مردودات المبيعات: ${formatCurrency(summary.salesReturns)}
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
${revSources.map((s, i) => `${i + 1}. ${s.name}: ${formatCurrency(s.amount)} (${s.percentage.toFixed(1)}%) — ${s.count} معاملة`).join('\n')}

## أعلى جهات الإيراد (تحليلي)
${topAnalytical.map((a, i) => `${i + 1}. ${a.name}: ${formatCurrency(a.amount)}`).join('\n')}

## توزيع المصروفات
${expCats.map((e, i) => `${i + 1}. ${e.name}: ${formatCurrency(e.amount)} (${e.percentage.toFixed(1)}%)`).join('\n')}

## الأداء الشهري التفصيلي
${monthlyDetail}

## ملخص الأداء
- إجمالي الأشهر: ${monthly.length} | مربحة: ${profitableMonths} | خاسرة: ${lossMonths}
- أفضل شهر: ${bestMonth.label} (${formatCurrency(bestMonth.netProfit)})
- أسوأ شهر: ${worstMonth.label} (${formatCurrency(worstMonth.netProfit)})
- نمو الإيرادات الشهري (آخر فترة): ${momGrowth || 'لا يوجد بيانات كافية'}
`
}
