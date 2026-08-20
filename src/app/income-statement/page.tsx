'use client'
import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { calcSummary, calcMonthlyData, calcRevenueBySource, calcExpensesByCategory, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { Printer, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import WaterfallChart from '@/components/charts/WaterfallChart'
import ExportButton from '@/components/ui/ExportButton'

export default function IncomeStatementPage() {
  const { entries, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(entries, period), [entries, period])
  const s = useMemo(() => calcSummary(filtered), [filtered])
  const monthly = useMemo(() => calcMonthlyData(filtered), [filtered])
  const revSources = useMemo(() => calcRevenueBySource(filtered), [filtered])
  const expCats = useMemo(() => calcExpensesByCategory(filtered), [filtered])

  const waterfallSteps = useMemo(() => [
    { label: 'الإيرادات', value: s.totalRevenue, type: 'start' as const },
    ...expCats.map(e => ({ label: e.name, value: -e.amount, type: 'negative' as const })),
    { label: 'صافي الربح', value: s.netProfit, type: 'total' as const },
  ], [s, expCats])

  const incomeExcelSheets = useMemo(() => [
    {
      name: 'قائمة الدخل',
      data: [
        ['قائمة الدخل', period.label],
        [],
        ['الإيرادات حسب الحساب', ''],
        ...revSources.map(r => [r.name, r.amount]),
        ['إجمالي الإيرادات', s.totalRevenue],
        [],
        ['المصروفات حسب الحساب', ''],
        ...expCats.map(e => [e.name, e.amount]),
        ['إجمالي المصروفات', s.totalExpenses],
        [],
        ['صافي الربح', s.netProfit],
        ['هامش صافي الربح', `${s.netMargin.toFixed(1)}%`],
      ] as (string | number | null)[][]
    },
    {
      name: 'التوزيع الشهري',
      data: [
        ['الشهر', 'الإيرادات', 'المصروفات', 'صافي الربح'],
        ...monthly.map(m => [m.label, m.revenue, m.expenses, m.netProfit]),
        ['الإجمالي', s.totalRevenue, s.totalExpenses, s.netProfit],
      ] as (string | number | null)[][]
    },
  ], [revSources, expCats, monthly, s, period.label])

  return (
    <AppShell title="قائمة الدخل (أرباح وخسائر)">
      <div className="space-y-6">
        <div id="income-statement-export" className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <div>
              <h2 className="text-lg font-bold text-gray-900">قائمة الدخل</h2>
              <p className="text-gray-400 text-sm">{period.label} · {filtered.length.toLocaleString('ar-EG')} سطر قيد</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Printer className="w-4 h-4" /> طباعة
              </button>
              <ExportButton exportId="income-statement-export" filename={`قائمة-الدخل-${period.label}`} excelSheets={incomeExcelSheets} />
            </div>
          </div>

          {/* Revenue by account */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-2">الإيرادات</h3>
            <div className="divide-y divide-gray-50">
              {revSources.map((r, i) => (
                <div key={i} className="flex justify-between items-center py-2 pr-2">
                  <span className="text-sm text-gray-600">{r.name}</span>
                  <span className="text-sm font-medium text-emerald-600">{formatCurrency(r.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-3 border-t border-gray-200 mt-1">
                <span className="text-sm font-bold text-gray-900">إجمالي الإيرادات</span>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(s.totalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Expenses by account */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-2">المصروفات</h3>
            <div className="divide-y divide-gray-50">
              {expCats.map((e, i) => (
                <div key={i} className="flex justify-between items-center py-2 pr-2">
                  <span className="text-sm text-gray-600">{e.name}</span>
                  <span className="text-sm font-medium text-red-500">({formatCurrency(e.amount)})</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-3 border-t border-gray-200 mt-1">
                <span className="text-sm font-bold text-gray-900">إجمالي المصروفات</span>
                <span className="text-sm font-bold text-red-600">({formatCurrency(s.totalExpenses)})</span>
              </div>
            </div>
          </div>

          {/* Net profit */}
          <div className={cn('flex justify-between items-center py-4 px-3 -mx-3 rounded-lg', s.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
            <span className="text-base font-bold text-gray-900">صافي الربح</span>
            <span className={cn('text-lg font-bold', s.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700')}>{formatCurrency(s.netProfit)}</span>
          </div>
          <div className="flex justify-between items-center py-2 pr-2">
            <span className="text-sm text-gray-500">هامش صافي الربح</span>
            <span className="text-sm text-gray-500">{s.netMargin.toFixed(1)}%</span>
          </div>
        </div>

        {/* Waterfall Chart */}
        {s.totalRevenue > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">مسار تكوين الربح (Waterfall)</h3>
            <WaterfallChart steps={waterfallSteps} />
            <div className="flex gap-6 mt-3 justify-center text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500 inline-block" /> إيرادات</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> مصروفات</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500 inline-block" /> صافي الربح</span>
            </div>
          </div>
        )}

        {/* Monthly Breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">التوزيع الشهري</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3 font-medium">الشهر</th>
                  <th className="text-left pb-3 font-medium">الإيرادات</th>
                  <th className="text-left pb-3 font-medium">المصروفات</th>
                  <th className="text-left pb-3 font-medium">صافي الربح</th>
                  <th className="text-left pb-3 font-medium">الاتجاه</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-700">{m.label}</td>
                    <td className="py-2.5 text-left text-emerald-600">{formatCurrency(m.revenue)}</td>
                    <td className="py-2.5 text-left text-red-500">{formatCurrency(m.expenses)}</td>
                    <td className={cn('py-2.5 text-left font-semibold', m.netProfit >= 0 ? 'text-blue-600' : 'text-red-600')}>
                      {formatCurrency(m.netProfit)}
                    </td>
                    <td className="py-2.5 text-left">
                      {m.netProfit >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 text-gray-900">الإجمالي</td>
                  <td className="py-3 text-left text-emerald-700">{formatCurrency(s.totalRevenue)}</td>
                  <td className="py-3 text-left text-red-600">{formatCurrency(s.totalExpenses)}</td>
                  <td className={cn('py-3 text-left', s.netProfit >= 0 ? 'text-blue-700' : 'text-red-700')}>{formatCurrency(s.netProfit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
