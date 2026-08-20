'use client'
import { useMemo, useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import ExportButton from '@/components/ui/ExportButton'
import { Info } from 'lucide-react'

const CASH_ACCOUNTS_KEY = 'ramy-cash-accounts'

export default function CashFlowPage() {
  const { accounts, entries, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(entries, period), [entries, period])

  // Which أصول accounts represent actual cash/bank is a judgment the chart of accounts doesn't
  // encode (nothing marks "الخزينة"/"QNB" as cash vs. "العملاء"/"المخزون" as not) — so the app
  // never guesses it. The user picks explicitly from their own real chart of accounts below.
  const cashCandidates = useMemo(() =>
    accounts.filter(a => a.type === 'أصول' && !accounts.some(o => o.parentCode === a.code))
      .sort((a, b) => a.code - b.code),
    [accounts]
  )

  const [selected, setSelected] = useState<number[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CASH_ACCOUNTS_KEY)
      if (raw) setSelected(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])
  const toggle = useCallback((code: number) => {
    setSelected(prev => {
      const next = prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
      localStorage.setItem(CASH_ACCOUNTS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const cashInPeriod = useMemo(() => filtered.filter(e => selectedSet.has(e.accountCode)), [filtered, selectedSet])
  const cashBeforePeriod = useMemo(() => entries.filter(e => selectedSet.has(e.accountCode) && e.entryDate < period.startDate), [entries, selectedSet, period])

  const openingBalance = useMemo(() => cashBeforePeriod.reduce((s, e) => s + (e.debit - e.credit), 0), [cashBeforePeriod])
  const cashIn = useMemo(() => cashInPeriod.reduce((s, e) => s + e.debit, 0), [cashInPeriod])
  const cashOut = useMemo(() => cashInPeriod.reduce((s, e) => s + e.credit, 0), [cashInPeriod])
  const netChange = cashIn - cashOut
  const closingBalance = openingBalance + netChange

  const monthly = useMemo(() => {
    const keys = new Set(cashInPeriod.map(e => `${e.entryDate.getFullYear()}-${e.entryDate.getMonth() + 1}`))
    const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    return Array.from(keys).map(key => {
      const [y, m] = key.split('-').map(Number)
      const inMonth = cashInPeriod.filter(e => e.entryDate.getFullYear() === y && e.entryDate.getMonth() + 1 === m)
      return {
        key, label: `${ARABIC_MONTHS[m - 1]} ${y}`,
        cashIn: inMonth.reduce((s, e) => s + e.debit, 0),
        cashOut: inMonth.reduce((s, e) => s + e.credit, 0),
      }
    }).sort((a, b) => a.key.localeCompare(b.key))
  }, [cashInPeriod])

  const transactions = useMemo(() => {
    let running = openingBalance
    return [...cashInPeriod]
      .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime())
      .map(e => {
        running += e.debit - e.credit
        return { ...e, runningBalance: running }
      })
  }, [cashInPeriod, openingBalance])

  const cashFlowExcelSheets = useMemo(() => [{
    name: 'التدفق النقدي',
    data: [
      ['قائمة حركة النقدية', period.label],
      [],
      ['رصيد أول المدة', openingBalance],
      ['إجمالي المقبوضات', cashIn],
      ['إجمالي المدفوعات', -cashOut],
      ['صافي الحركة', netChange],
      ['رصيد آخر المدة', closingBalance],
      [],
      ['التاريخ', 'البيان', 'نوع المستند', 'مدين', 'دائن', 'الرصيد بعد الحركة'],
      ...transactions.map(t => [t.entryDate.toLocaleDateString('ar-EG'), t.description, t.docType, t.debit || null, t.credit || null, t.runningBalance]),
    ] as (string | number | null)[][]
  }], [period.label, openingBalance, cashIn, cashOut, netChange, closingBalance, transactions])

  if (cashCandidates.length === 0) {
    return (
      <AppShell title="قائمة التدفق النقدي">
        <div className="flex flex-col items-center justify-center h-96 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-xl font-medium mb-2">لا توجد بيانات</p>
          <p className="text-sm">ارفع ملف Excel لبدء التحليل</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="قائمة التدفق النقدي">
      <div id="cashflow-export-area" className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-1">حسابات النقدية والبنوك</h3>
          <p className="text-gray-400 text-xs mb-4">اختر الحسابات التي تمثل النقدية والبنوك لديك من دليل الحسابات — التطبيق لا يفترض ذلك تلقائياً</p>
          <div className="flex flex-wrap gap-2">
            {cashCandidates.map(a => (
              <button key={a.code} onClick={() => toggle(a.code)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  selectedSet.has(a.code) ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-emerald-300')}>
                {a.name} <span className="opacity-60">#{a.code}</span>
              </button>
            ))}
          </div>
        </div>

        {selected.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-amber-700 text-sm">اختر حساب نقدية أو بنك واحد على الأقل بالأعلى لعرض قائمة التدفق النقدي</p>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <ExportButton exportId="cashflow-export-area" filename="قائمة-التدفق-النقدي" excelSheets={cashFlowExcelSheets} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                <p className="text-gray-500 text-sm mb-1">رصيد أول المدة</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(openingBalance)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                <p className="text-gray-500 text-sm mb-1">إجمالي المقبوضات</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(cashIn)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
                <p className="text-gray-500 text-sm mb-1">إجمالي المدفوعات</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(cashOut)}</p>
              </div>
              <div className={cn('rounded-xl border p-5 text-center', closingBalance >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
                <p className="text-gray-500 text-sm mb-1">رصيد آخر المدة</p>
                <p className={cn('text-xl font-bold', closingBalance >= 0 ? 'text-emerald-700' : 'text-red-700')}>{formatCurrency(closingBalance)}</p>
              </div>
            </div>

            {monthly.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">المقبوضات والمدفوعات الشهرية</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]} contentStyle={{ fontFamily: 'Cairo' }} />
                    <Bar dataKey="cashIn" name="مقبوضات" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cashOut" name="مدفوعات" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">حركات النقدية التفصيلية</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 text-xs">
                      <th className="text-right pb-3 font-medium">التاريخ</th>
                      <th className="text-right pb-3 font-medium">البيان</th>
                      <th className="text-right pb-3 font-medium">نوع المستند</th>
                      <th className="text-left pb-3 font-medium">مقبوضات</th>
                      <th className="text-left pb-3 font-medium">مدفوعات</th>
                      <th className="text-left pb-3 font-medium">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 text-gray-700">{t.entryDate.toLocaleDateString('ar-EG')}</td>
                        <td className="py-2 text-gray-700">{t.description}</td>
                        <td className="py-2 text-gray-500 text-xs">{t.docType}</td>
                        <td className="py-2 text-left text-emerald-600">{t.debit > 0 ? formatCurrency(t.debit) : ''}</td>
                        <td className="py-2 text-left text-red-500">{t.credit > 0 ? formatCurrency(t.credit) : ''}</td>
                        <td className="py-2 text-left font-medium text-gray-900">{formatCurrency(t.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
