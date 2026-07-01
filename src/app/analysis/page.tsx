'use client'
import { useMemo, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import TrendLine from '@/components/charts/TrendLine'
import { useFinancialStore } from '@/store/financial-store'
import {
  calcSummary, calcMonthlyData, calcHorizontalAnalysis,
  filterByPeriod, formatCurrency
} from '@/lib/financial-engine'
import { yearPeriod, getAvailableYears } from '@/lib/period-utils'
import { cn } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend } from 'recharts'
import ExportButton from '@/components/ui/ExportButton'

export default function AnalysisPage() {
  const { transactions, period } = useFinancialStore()
  const [activeTab, setActiveTab] = useState<'ratios' | 'trend' | 'horizontal' | 'seasonal'>('ratios')

  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const s = useMemo(() => calcSummary(filtered), [filtered])
  const monthly = useMemo(() => calcMonthlyData(filtered), [filtered])

  const years = getAvailableYears(transactions)
  const [year1, setYear1] = useState<number>(years[0] ?? new Date().getFullYear())
  const [year2, setYear2] = useState<number>(years[1] ?? new Date().getFullYear() - 1)

  const data1 = useMemo(() => calcMonthlyData(filterByPeriod(transactions, yearPeriod(year1))), [transactions, year1])
  const data2 = useMemo(() => calcMonthlyData(filterByPeriod(transactions, yearPeriod(year2))), [transactions, year2])
  const horizontal = useMemo(() => calcHorizontalAnalysis(data1, data2), [data1, data2])

  const [variableCostPct, setVariableCostPct] = useState(30)

  const avgRevenue = monthly.length > 0 ? monthly.reduce((s, m) => s + m.revenue, 0) / monthly.length : 0
  const bestMonth = monthly.reduce((b, m) => m.netProfit > b.netProfit ? m : b, monthly[0] ?? { label: '-', netProfit: 0 })
  const worstMonth = monthly.reduce((w, m) => m.netProfit < w.netProfit ? m : w, monthly[0] ?? { label: '-', netProfit: 0 })
  const totalOpEx = s.adminExpenses + s.sellingExpenses + s.operatingExpenses + s.otherExpenses
  const variablePortion = totalOpEx * (variableCostPct / 100)
  const fixedCosts = totalOpEx - variablePortion
  const contributionMarginPct = s.netSales > 0
    ? ((s.netSales - s.purchases - variablePortion) / s.netSales) * 100
    : s.grossMargin
  const breakEvenRevenue = contributionMarginPct > 0 ? (fixedCosts / (contributionMarginPct / 100)) : 0

  const tabs = [
    { id: 'ratios', label: 'تحليل النسب' },
    { id: 'trend', label: 'تحليل الاتجاه' },
    { id: 'horizontal', label: 'التحليل الأفقي' },
    { id: 'seasonal', label: 'الموسمية والتعادل' },
  ] as const

  const analysisExcelSheets = useMemo(() => {
    if (activeTab === 'ratios') return [{
      name: 'تحليل النسب',
      data: [
        ['النسبة', 'القيمة', 'طريقة الحساب'],
        ['هامش الربح الإجمالي', `${s.grossMargin.toFixed(1)}%`, `${formatCurrency(s.grossProfit)} / ${formatCurrency(s.netSales)}`],
        ['هامش صافي الربح', `${s.netMargin.toFixed(1)}%`, `${formatCurrency(s.netProfit)} / ${formatCurrency(s.netSales)}`],
        ['نسبة تكلفة المبيعات', `${s.netSales > 0 ? ((s.purchases / s.netSales) * 100).toFixed(1) : 0}%`, ''],
        ['نسبة مصروفات البيع', `${s.netSales > 0 ? ((s.sellingExpenses / s.netSales) * 100).toFixed(1) : 0}%`, ''],
        ['نسبة المصروفات الإدارية', `${s.netSales > 0 ? ((s.adminExpenses / s.netSales) * 100).toFixed(1) : 0}%`, ''],
        ['نسبة إجمالي المصروفات', `${s.netSales > 0 ? ((s.totalExpenses / s.netSales) * 100).toFixed(1) : 0}%`, ''],
      ] as (string | number | null)[][]
    }]
    if (activeTab === 'trend') return [{
      name: 'تحليل الاتجاه',
      data: [
        ['الشهر', 'الإيراد', 'النمو %', 'صافي الربح', 'نمو الربح %'],
        ...monthly.map((m, i) => {
          const prev = monthly[i - 1]
          const revGrowth = prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue * 100).toFixed(1) : '-'
          const profGrowth = prev && prev.netProfit !== 0 ? ((m.netProfit - prev.netProfit) / Math.abs(prev.netProfit) * 100).toFixed(1) : '-'
          return [m.label, m.revenue, revGrowth, m.netProfit, profGrowth]
        }),
      ] as (string | number | null)[][]
    }]
    if (activeTab === 'horizontal') return [{
      name: 'التحليل الأفقي',
      data: [
        ['الشهر', `إيرادات ${year1}`, `إيرادات ${year2}`, 'التغيير %', `ربح ${year1}`, `ربح ${year2}`, 'التغيير %'],
        ...horizontal.map(r => [r.label, r.currentRevenue, r.prevRevenue, `${r.revenueChangePct.toFixed(1)}%`, r.currentNetProfit, r.prevNetProfit, `${r.netProfitChangePct.toFixed(1)}%`]),
      ] as (string | number | null)[][]
    }]
    return [{
      name: 'الموسمية',
      data: [
        ['أفضل شهر', bestMonth.label, formatCurrency(bestMonth.netProfit)],
        ['أسوأ شهر', worstMonth.label, formatCurrency(worstMonth.netProfit)],
        ['متوسط الإيراد الشهري', formatCurrency(avgRevenue), ''],
        [],
        ['نقطة التعادل', formatCurrency(breakEvenRevenue), ''],
        ['التكاليف الثابتة', formatCurrency(fixedCosts), ''],
        ['هامش المساهمة', `${contributionMarginPct.toFixed(1)}%`, ''],
      ] as (string | number | null)[][]
    }]
  }, [activeTab, s, monthly, horizontal, year1, year2, bestMonth, worstMonth, avgRevenue, breakEvenRevenue, fixedCosts, contributionMarginPct])

  return (
    <AppShell title="التحليل المالي المتقدم">
      <div className="space-y-6">
        {/* Tabs + Export */}
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-1 flex gap-1 flex-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
                {tab.label}
              </button>
            ))}
          </div>
          <ExportButton exportId="analysis-export-area" filename={`تحليل-${tabs.find(t => t.id === activeTab)?.label ?? ''}`} excelSheets={analysisExcelSheets} />
        </div>

        <div id="analysis-export-area">
        {/* Ratios */}
        {activeTab === 'ratios' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'هامش الربح الإجمالي', value: s.grossMargin, desc: 'مجمل الربح / صافي المبيعات', color: s.grossMargin >= 30 ? 'text-emerald-600' : 'text-orange-500' },
                { label: 'هامش صافي الربح', value: s.netMargin, desc: 'صافي الربح / صافي المبيعات', color: s.netMargin >= 10 ? 'text-emerald-600' : 'text-red-500' },
                { label: 'نسبة المصروفات', value: s.netSales > 0 ? (s.totalExpenses / s.netSales) * 100 : 0, desc: 'المصروفات / صافي المبيعات', color: 'text-red-500' },
                { label: 'نسبة المشتريات', value: s.netSales > 0 ? (s.purchases / s.netSales) * 100 : 0, desc: 'المشتريات / صافي المبيعات', color: 'text-orange-500' },
              ].map((r, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5">
                  <p className="text-gray-500 text-xs mb-2">{r.label}</p>
                  <p className={cn('text-3xl font-bold', r.color)}>{r.value.toFixed(1)}%</p>
                  <p className="text-gray-400 text-xs mt-2">{r.desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 overflow-x-auto">
              <h3 className="font-semibold text-gray-900 mb-4">جدول النسب المالية التفصيلي</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs">
                    <th className="text-right pb-3 font-medium">النسبة</th>
                    <th className="text-left pb-3 font-medium">القيمة</th>
                    <th className="text-right pb-3 font-medium">طريقة الحساب</th>
                    <th className="text-left pb-3 font-medium">التقييم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { name: 'هامش الربح الإجمالي', val: s.grossMargin, formula: `${formatCurrency(s.grossProfit)} / ${formatCurrency(s.netSales)}`, note: s.grossMargin >= 30 ? '✓ جيد' : '⚠ منخفض' },
                    { name: 'هامش صافي الربح', val: s.netMargin, formula: `${formatCurrency(s.netProfit)} / ${formatCurrency(s.netSales)}`, note: s.netMargin >= 10 ? '✓ جيد' : '⚠ مراجعة' },
                    { name: 'نسبة تكلفة المبيعات', val: s.netSales > 0 ? (s.purchases / s.netSales) * 100 : 0, formula: `${formatCurrency(s.purchases)} / ${formatCurrency(s.netSales)}`, note: '' },
                    { name: 'نسبة مصروفات البيع', val: s.netSales > 0 ? (s.sellingExpenses / s.netSales) * 100 : 0, formula: `${formatCurrency(s.sellingExpenses)} / ${formatCurrency(s.netSales)}`, note: '' },
                    { name: 'نسبة المصروفات الإدارية', val: s.netSales > 0 ? (s.adminExpenses / s.netSales) * 100 : 0, formula: `${formatCurrency(s.adminExpenses)} / ${formatCurrency(s.netSales)}`, note: '' },
                    { name: 'نسبة إجمالي المصروفات', val: s.netSales > 0 ? (s.totalExpenses / s.netSales) * 100 : 0, formula: `${formatCurrency(s.totalExpenses)} / ${formatCurrency(s.netSales)}`, note: '' },
                  ].map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="py-3 text-left">
                        <span className={cn('text-lg font-bold', r.val >= 10 ? 'text-emerald-600' : 'text-orange-500')}>{r.val.toFixed(1)}%</span>
                      </td>
                      <td className="py-3 text-gray-500 text-xs">{r.formula}</td>
                      <td className="py-3 text-left text-xs">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trend */}
        {activeTab === 'trend' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">تحليل الاتجاه الشهري</h3>
              <TrendLine data={monthly} />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">نمو الإيرادات شهر على شهر (%)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 text-xs">
                      <th className="text-right pb-3">الشهر</th>
                      <th className="text-left pb-3">الإيراد</th>
                      <th className="text-left pb-3">النمو %</th>
                      <th className="text-left pb-3">صافي الربح</th>
                      <th className="text-left pb-3">نمو الربح %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m, i) => {
                      const prev = monthly[i - 1]
                      const revGrowth = prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue) * 100 : null
                      const profGrowth = prev && prev.netProfit !== 0 ? ((m.netProfit - prev.netProfit) / Math.abs(prev.netProfit)) * 100 : null
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-700">{m.label}</td>
                          <td className="py-2 text-left text-emerald-600">{formatCurrency(m.revenue)}</td>
                          <td className="py-2 text-left">
                            {revGrowth !== null && <span className={cn('text-sm font-medium', revGrowth >= 0 ? 'text-emerald-500' : 'text-red-500')}>{revGrowth >= 0 ? '+' : ''}{revGrowth.toFixed(1)}%</span>}
                          </td>
                          <td className="py-2 text-left">{formatCurrency(m.netProfit)}</td>
                          <td className="py-2 text-left">
                            {profGrowth !== null && <span className={cn('text-sm font-medium', profGrowth >= 0 ? 'text-emerald-500' : 'text-red-500')}>{profGrowth >= 0 ? '+' : ''}{profGrowth.toFixed(1)}%</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Margin Trend */}
        {activeTab === 'trend' && monthly.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">هوامش الربح الشهرية (%)</h3>
            <p className="text-gray-400 text-xs mb-4">هامش مجمل الربح وصافي الربح بالنسبة المئوية شهرياً</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={55} />
                <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Tooltip formatter={(v) => [`${(v as number).toFixed(1)}%`]} contentStyle={{ fontFamily: 'Cairo' }} />
                <Legend formatter={(val) => val === 'grossMargin' ? 'هامش مجمل الربح' : 'هامش صافي الربح'} />
                <Line type="monotone" dataKey="grossMargin" stroke="#10b981" strokeWidth={2} dot={false} name="grossMargin" />
                <Line type="monotone" dataKey="netMargin" stroke="#6366f1" strokeWidth={2} dot={false} name="netMargin" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Horizontal */}
        {activeTab === 'horizontal' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
              <p className="text-gray-600 text-sm font-medium">مقارنة بين:</p>
              <select value={year1} onChange={e => setYear1(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-gray-400">و</span>
              <select value={year2} onChange={e => setYear2(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {horizontal.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">مقارنة الإيرادات سنة بسنة</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={horizontal.map(r => ({ label: r.label.split(' ')[0], current: r.currentRevenue, prev: r.prevRevenue, currentProfit: r.currentNetProfit, prevProfit: r.prevNetProfit }))} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [formatCurrency(v as number)]} contentStyle={{ fontFamily: 'Cairo' }} />
                    <Legend formatter={(val) => val === 'current' ? `إيرادات ${year1}` : `إيرادات ${year2}`} />
                    <Bar dataKey="current" fill="#10b981" name="current" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="prev" fill="#d1fae5" name="prev" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400">
                    <th className="text-right pb-3">الشهر</th>
                    <th className="text-left pb-3">إيرادات {year1}</th>
                    <th className="text-left pb-3">إيرادات {year2}</th>
                    <th className="text-left pb-3">التغيير</th>
                    <th className="text-left pb-3">ربح {year1}</th>
                    <th className="text-left pb-3">ربح {year2}</th>
                    <th className="text-left pb-3">التغيير</th>
                  </tr>
                </thead>
                <tbody>
                  {horizontal.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-700">{r.label}</td>
                      <td className="py-2 text-left text-emerald-600">{formatCurrency(r.currentRevenue)}</td>
                      <td className="py-2 text-left text-gray-500">{formatCurrency(r.prevRevenue)}</td>
                      <td className="py-2 text-left">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', r.revenueChangePct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                          {r.revenueChangePct >= 0 ? '+' : ''}{r.revenueChangePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 text-left font-medium">{formatCurrency(r.currentNetProfit)}</td>
                      <td className="py-2 text-left text-gray-500">{formatCurrency(r.prevNetProfit)}</td>
                      <td className="py-2 text-left">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', r.netProfitChangePct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                          {r.netProfitChangePct >= 0 ? '+' : ''}{r.netProfitChangePct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Seasonal & Break-even */}
        {activeTab === 'seasonal' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                <p className="text-emerald-600 text-xs font-semibold mb-1">أفضل شهر</p>
                <p className="text-gray-900 font-bold text-lg">{bestMonth.label}</p>
                <p className="text-emerald-600 font-medium">{formatCurrency(bestMonth.netProfit)}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                <p className="text-red-600 text-xs font-semibold mb-1">أسوأ شهر</p>
                <p className="text-gray-900 font-bold text-lg">{worstMonth.label}</p>
                <p className="text-red-600 font-medium">{formatCurrency(worstMonth.netProfit)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <p className="text-blue-600 text-xs font-semibold mb-1">متوسط الإيراد الشهري</p>
                <p className="text-gray-900 font-bold text-lg">{formatCurrency(avgRevenue)}</p>
                <p className="text-blue-500 text-xs">{monthly.length} شهر</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">نقطة التعادل (Break-Even)</h3>
              </div>
              <p className="text-gray-400 text-xs mb-4">الحد الأدنى للإيراد لتغطية التكاليف الثابتة</p>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-700 font-medium">نسبة التكاليف المتغيرة من المصروفات</label>
                  <span className="text-emerald-700 font-bold">{variableCostPct}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={variableCostPct}
                  onChange={e => setVariableCostPct(Number(e.target.value))}
                  className="w-full accent-emerald-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0% (كلها ثابتة)</span><span>100% (كلها متغيرة)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-500 text-xs mb-1">التكاليف الثابتة</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(fixedCosts)}</p>
                  <p className="text-gray-400 text-xs mt-1">{(100 - variableCostPct)}% من إجمالي المصروفات</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4">
                  <p className="text-gray-500 text-xs mb-1">هامش المساهمة</p>
                  <p className="text-xl font-bold text-emerald-700">{contributionMarginPct.toFixed(1)}%</p>
                  <p className="text-gray-400 text-xs mt-1">بعد التكاليف المتغيرة</p>
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                <p className="text-indigo-700 text-sm font-medium">
                  نقطة التعادل = {formatCurrency(breakEvenRevenue)} من الإيرادات
                </p>
                <p className="text-indigo-500 text-xs mt-1">
                  {s.netSales > 0 && contributionMarginPct > 0
                    ? `أنت ${s.netSales > breakEvenRevenue ? 'فوق' : 'تحت'} نقطة التعادل بفارق ${formatCurrency(Math.abs(s.netSales - breakEvenRevenue))}`
                    : 'أدخل بيانات لحساب نقطة التعادل'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">الأداء الشهري مقارنة بالمتوسط</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={55} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 10 }} />
                  <ReferenceLine y={avgRevenue} stroke="#6366f1" strokeDasharray="5 5" label={{ value: 'المتوسط', position: 'right', fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]} contentStyle={{ fontFamily: 'Cairo' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        </div>{/* end analysis-export-area */}
      </div>
    </AppShell>
  )
}
