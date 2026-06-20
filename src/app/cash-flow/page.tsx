'use client'
import { useMemo, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { calcSummary, calcMonthlyData, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { cn } from '@/lib/utils'
import TrendLine from '@/components/charts/TrendLine'
import ExportButton from '@/components/ui/ExportButton'

export default function CashFlowPage() {
  const { transactions, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const s = useMemo(() => calcSummary(filtered), [filtered])
  const monthly = useMemo(() => calcMonthlyData(filtered), [filtered])

  const [newLoans, setNewLoans] = useState(0)
  const [loanRepayments, setLoanRepayments] = useState(0)
  const [dividends, setDividends] = useState(0)

  const operatingCF = s.netProfit + s.salesReturns
  const investingCF = -s.fixedAssets
  const financingCF = newLoans - loanRepayments - dividends
  const netCF = operatingCF + investingCF + financingCF

  const cfInput = (val: number, setter: (v: number) => void) => (
    <input
      type="number"
      value={val || ''}
      onChange={e => setter(parseFloat(e.target.value) || 0)}
      placeholder="0"
      className="w-36 border border-gray-200 rounded-lg px-2 py-1 text-sm text-left focus:outline-none focus:border-emerald-400"
    />
  )

  const cfRows = [
    { section: 'أنشطة التشغيل', items: [
      { label: 'صافي الربح', value: s.netProfit },
      { label: 'تعديل: مردودات المبيعات', value: s.salesReturns, note: 'استرداد نقدي' },
      { label: 'تعديل: المشتريات المدفوعة', value: -s.purchases },
      { label: 'تعديل: المصروفات المدفوعة', value: -s.totalExpenses },
    ], total: operatingCF },
    { section: 'أنشطة الاستثمار', items: [
      { label: 'شراء أصول ثابتة', value: -s.fixedAssets },
    ], total: investingCF },
    { section: 'أنشطة التمويل', items: [
      { label: 'قروض جديدة', value: newLoans, input: cfInput(newLoans, setNewLoans) },
      { label: 'سداد قروض', value: -loanRepayments, input: cfInput(loanRepayments, setLoanRepayments) },
      { label: 'توزيعات أرباح', value: -dividends, input: cfInput(dividends, setDividends) },
    ], total: financingCF },
  ]

  const cashFlowExcelSheets = useMemo(() => [{
    name: 'التدفق النقدي',
    data: [
      ['قائمة التدفق النقدي'],
      [],
      ['أنشطة التشغيل', ''],
      ['صافي الربح', s.netProfit],
      ['تعديل: مردودات المبيعات', s.salesReturns],
      ['تعديل: المشتريات المدفوعة', -s.purchases],
      ['تعديل: المصروفات المدفوعة', -s.totalExpenses],
      ['صافي تدفق التشغيل', operatingCF],
      [],
      ['أنشطة الاستثمار', ''],
      ['شراء أصول ثابتة', -s.fixedAssets],
      ['صافي تدفق الاستثمار', investingCF],
      [],
      ['أنشطة التمويل', ''],
      ['قروض جديدة', newLoans],
      ['سداد قروض', -loanRepayments],
      ['توزيعات أرباح', -dividends],
      ['صافي تدفق التمويل', financingCF],
      [],
      ['صافي التدفق النقدي الكلي', netCF],
    ] as (string | number | null)[][]
  }], [s, operatingCF, investingCF, financingCF, netCF, newLoans, loanRepayments, dividends])

  return (
    <AppShell title="قائمة التدفق النقدي">
      <div id="cashflow-export-area" className="space-y-6">
        <div className="flex justify-end">
          <ExportButton exportId="cashflow-export-area" filename="قائمة-التدفق-النقدي" excelSheets={cashFlowExcelSheets} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
            <p className="text-gray-500 text-sm mb-1">تدفق التشغيل</p>
            <p className={cn('text-xl font-bold', operatingCF >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(operatingCF)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
            <p className="text-gray-500 text-sm mb-1">تدفق الاستثمار</p>
            <p className={cn('text-xl font-bold', investingCF >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(investingCF)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
            <p className="text-gray-500 text-sm mb-1">تدفق التمويل</p>
            <p className={cn('text-xl font-bold', financingCF >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(financingCF)}</p>
          </div>
          <div className={cn('rounded-xl border p-5 text-center', netCF >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
            <p className="text-gray-500 text-sm mb-1">صافي التدفق النقدي</p>
            <p className={cn('text-xl font-bold', netCF >= 0 ? 'text-emerald-700' : 'text-red-700')}>{formatCurrency(netCF)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">قائمة التدفق النقدي التفصيلية</h3>
          {cfRows.map((section, si) => (
            <div key={si} className="mb-6">
              <h4 className="text-sm font-bold text-gray-900 mb-3 bg-gray-50 px-3 py-2 rounded-lg">{section.section}</h4>
              <div className="space-y-2 pr-4">
                {section.items.map((item, ii) => (
                  <div key={ii} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                    <span className="text-sm text-gray-600">{item.label}{('note' in item && item.note) ? ` (${item.note})` : ''}</span>
                    <div className="flex items-center gap-3">
                      {'input' in item && item.input}
                      <span className={cn('text-sm font-medium min-w-[120px] text-left', item.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {item.value >= 0 ? '' : '('}{formatCurrency(Math.abs(item.value))}{item.value < 0 ? ')' : ''}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2 border-t border-gray-200 font-bold mt-2">
                  <span className="text-sm text-gray-900">صافي {section.section}</span>
                  <span className={cn('text-sm', section.total >= 0 ? 'text-emerald-700' : 'text-red-600')}>{formatCurrency(section.total)}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center py-3 border-t-2 border-gray-300 mt-4">
            <span className="font-bold text-gray-900">صافي التدفق النقدي الكلي</span>
            <span className={cn('text-lg font-bold', netCF >= 0 ? 'text-emerald-700' : 'text-red-700')}>{formatCurrency(netCF)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">اتجاه الإيرادات والمصروفات الشهري</h3>
          <TrendLine data={monthly} />
        </div>
      </div>
    </AppShell>
  )
}
