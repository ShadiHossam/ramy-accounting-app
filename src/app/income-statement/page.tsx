'use client'
import { useMemo, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { calcSummary, calcMonthlyData, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { Printer, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import WaterfallChart from '@/components/charts/WaterfallChart'
import ExportButton from '@/components/ui/ExportButton'

export default function IncomeStatementPage() {
  const { transactions, period } = useFinancialStore()
  const printRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const s = useMemo(() => calcSummary(filtered), [filtered])
  const monthly = useMemo(() => calcMonthlyData(filtered), [filtered])

  const rows = useMemo(() => [
    { label: 'إجمالي الإيرادات', value: s.totalRevenue, level: 0, isTotal: false, color: 'text-emerald-600' },
    { label: 'مردودات المبيعات', value: s.salesReturns, level: 1, isTotal: false, color: 'text-red-500', deduct: true },
    { label: 'صافي المبيعات', value: s.netSales, level: 0, isTotal: true, color: 'text-gray-900' },
    { label: 'تكلفة المشتريات', value: s.purchases, level: 1, isTotal: false, color: 'text-red-500', deduct: true },
    { label: 'مجمل الربح', value: s.grossProfit, level: 0, isTotal: true, color: s.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700', highlight: true },
    { label: 'هامش الربح الإجمالي', value: s.grossMargin, level: 1, isTotal: false, color: 'text-gray-500', isPercent: true },
    { label: 'مصروفات بيعية وتسويقية', value: s.sellingExpenses, level: 1, isTotal: false, color: 'text-red-500', deduct: true },
    { label: 'مصروفات عمومية وإدارية', value: s.adminExpenses, level: 1, isTotal: false, color: 'text-red-500', deduct: true },
    { label: 'مصروفات التشغيل', value: s.operatingExpenses, level: 1, isTotal: false, color: 'text-red-500', deduct: true },
    ...(s.otherExpenses > 0 ? [{ label: 'مصروفات أخرى (غير مصنّفة)', value: s.otherExpenses, level: 1, isTotal: false, color: 'text-red-500', deduct: true }] : []),
    { label: 'إجمالي المصروفات', value: s.totalExpenses, level: 0, isTotal: true, color: 'text-red-600' },
    { label: 'صافي الربح قبل الضريبة', value: s.netProfit + s.taxExpenses, level: 0, isTotal: true, color: 'text-gray-900' },
    { label: 'ضرائب (مصلحة الضرائب)', value: s.taxExpenses, level: 1, isTotal: false, color: 'text-red-500', deduct: true },
    { label: 'صافي الربح', value: s.netProfit, level: 0, isTotal: true, color: s.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700', highlight: true, big: true },
    { label: 'هامش صافي الربح', value: s.netMargin, level: 1, isTotal: false, color: 'text-gray-500', isPercent: true },
  ], [s])

  const incomeExcelSheets = useMemo(() => [
    {
      name: 'قائمة الدخل',
      data: [
        ['قائمة الدخل', period.label],
        [],
        ['البند', 'القيمة'],
        ...rows.map(r => [r.label, r.isPercent ? `${r.value.toFixed(1)}%` : r.value]),
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
  ], [rows, monthly, s, period.label])

  return (
    <AppShell title="قائمة الدخل (أرباح وخسائر)">
      <div className="space-y-6">
        <div ref={printRef} id="income-statement-export" className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <div>
              <h2 className="text-lg font-bold text-gray-900">قائمة الدخل</h2>
              <p className="text-gray-400 text-sm">{period.label} · {filtered.length.toLocaleString('ar-EG')} سجل</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Printer className="w-4 h-4" /> طباعة
              </button>
              <ExportButton exportId="income-statement-export" filename={`قائمة-الدخل-${period.label}`} excelSheets={incomeExcelSheets} />
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <div key={i} className={cn(
                'flex justify-between items-center py-3',
                row.level === 1 ? 'pr-6' : '',
                row.highlight ? 'bg-gray-50 rounded-lg px-3 -mx-3' : '',
                row.big ? 'py-4' : '',
              )}>
                <span className={cn('text-sm', row.isTotal ? 'font-bold' : 'text-gray-600', row.big ? 'text-base' : '')}>
                  {row.label}
                </span>
                <span className={cn('font-medium', row.color, row.big ? 'text-lg font-bold' : 'text-sm')}>
                  {row.isPercent ? `${row.value.toFixed(1)}%` : (
                    <>{row.deduct && row.value > 0 ? '(' : ''}{formatCurrency(row.value)}{row.deduct && row.value > 0 ? ')' : ''}</>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Waterfall Chart */}
        {s.totalRevenue > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">مسار تكوين الربح (Waterfall)</h3>
            <WaterfallChart
              totalRevenue={s.totalRevenue}
              salesReturns={s.salesReturns}
              netSales={s.netSales}
              purchases={s.purchases}
              grossProfit={s.grossProfit}
              totalExpenses={s.totalExpenses}
              netProfit={s.netProfit}
            />
            <div className="flex gap-6 mt-3 justify-center text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500 inline-block" /> إيرادات</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> إجمالي</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> خصومات</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500 inline-block" /> صافي</span>
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
