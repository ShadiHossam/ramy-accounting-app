'use client'
import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { calcSummary, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { Printer, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BalanceSheetPage() {
  const { transactions, period, balanceSheetInputs, setBalanceSheetInputs } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const s = useMemo(() => calcSummary(filtered), [filtered])

  const { cash, receivables, inventory, capital, shortTermDebt, longTermDebt } = balanceSheetInputs
  const setCash = (v: number) => setBalanceSheetInputs({ cash: v })
  const setReceivables = (v: number) => setBalanceSheetInputs({ receivables: v })
  const setInventory = (v: number) => setBalanceSheetInputs({ inventory: v })
  const setCapital = (v: number) => setBalanceSheetInputs({ capital: v })
  const setShortTermDebt = (v: number) => setBalanceSheetInputs({ shortTermDebt: v })
  const setLongTermDebt = (v: number) => setBalanceSheetInputs({ longTermDebt: v })

  const currentAssets = cash + receivables + inventory
  const totalAssets = currentAssets + s.fixedAssets
  const totalLiabilities = shortTermDebt + longTermDebt
  const retainedEarnings = s.netProfit
  const totalEquity = capital + retainedEarnings
  const totalLiabAndEquity = totalLiabilities + totalEquity
  const diff = totalAssets - totalLiabAndEquity

  const fmtInput = (val: number, setter: (v: number) => void) => (
    <input
      type="number"
      value={val || ''}
      onChange={e => setter(parseFloat(e.target.value) || 0)}
      placeholder="0"
      className="w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-left text-gray-700 focus:outline-none focus:border-emerald-400"
    />
  )

  return (
    <AppShell title="الميزانية العمومية">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-sm">
            بعض البنود (النقدية، المخزون، رأس المال، الديون) تحتاج إدخال يدوي. بيانات الأصول الثابتة وصافي الربح مأخوذة تلقائياً من الشيت.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4 pb-2 border-b">الأصول</h3>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">أصول متداولة</p>
              <div className="space-y-3">
                <BalRow label="النقدية والبنوك" value={cash}>{fmtInput(cash, setCash)}</BalRow>
                <BalRow label="ذمم مدينة (عملاء)" value={receivables}>{fmtInput(receivables, setReceivables)}</BalRow>
                <BalRow label="المخزون" value={inventory}>{fmtInput(inventory, setInventory)}</BalRow>
                <BalRow label="إجمالي الأصول المتداولة" value={currentAssets} total />
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">أصول ثابتة</p>
              <BalRow label="أصول ثابتة (من الشيت)" value={s.fixedAssets} highlight />
            </div>

            <BalRow label="إجمالي الأصول" value={totalAssets} total big className="border-t-2 border-gray-300 mt-4 pt-4" />
          </div>

          {/* Liabilities & Equity */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4 pb-2 border-b">الخصوم وحقوق الملكية</h3>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">خصوم متداولة</p>
              <BalRow label="ديون قصيرة الأجل" value={shortTermDebt}>{fmtInput(shortTermDebt, setShortTermDebt)}</BalRow>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">خصوم طويلة الأجل</p>
              <BalRow label="ديون طويلة الأجل" value={longTermDebt}>{fmtInput(longTermDebt, setLongTermDebt)}</BalRow>
              <BalRow label="إجمالي الخصوم" value={totalLiabilities} total />
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">حقوق الملكية</p>
              <BalRow label="رأس المال" value={capital}>{fmtInput(capital, setCapital)}</BalRow>
              <BalRow label="الأرباح المحتجزة (صافي الربح)" value={retainedEarnings} highlight />
              <BalRow label="إجمالي حقوق الملكية" value={totalEquity} total />
            </div>

            <BalRow label="إجمالي الخصوم وحقوق الملكية" value={totalLiabAndEquity} total big className="border-t-2 border-gray-300 mt-4 pt-4" />

            {Math.abs(diff) > 1 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm font-medium">
                  فرق الميزانية: {formatCurrency(Math.abs(diff))} — أدخل الأرقام الناقصة
                </p>
              </div>
            )}
            {Math.abs(diff) <= 1 && totalAssets > 0 && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-emerald-600 text-sm font-medium">✓ الميزانية متوازنة</p>
              </div>
            )}
          </div>
        </div>

        <div className="text-left">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Printer className="w-4 h-4" /> طباعة الميزانية
          </button>
        </div>
      </div>
    </AppShell>
  )
}

function BalRow({ label, value, total, big, highlight, children, className }: {
  label: string; value: number; total?: boolean; big?: boolean; highlight?: boolean; children?: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('flex justify-between items-center py-2', total ? 'font-bold' : '', highlight ? 'bg-emerald-50 rounded-lg px-2 -mx-2' : '', className)}>
      <span className={cn('text-sm text-gray-700', total ? 'font-bold' : '', big ? 'text-base' : '')}>{label}</span>
      <div className="flex items-center gap-3">
        {children}
        <span className={cn('text-sm font-medium min-w-[140px] text-left', big ? 'text-base font-bold' : '', value >= 0 ? 'text-gray-900' : 'text-red-600')}>
          {formatCurrency(value)}
        </span>
      </div>
    </div>
  )
}
