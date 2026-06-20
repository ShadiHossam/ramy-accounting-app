'use client'
import { useMemo, useState, useRef } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { calcExpensesByCategory, calcRevenueBySource, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { cn } from '@/lib/utils'
import { Plus, Printer } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ExportButton from '@/components/ui/ExportButton'

interface BudgetRow {
  id: string
  category: string
  type: 'revenue' | 'expense'
  budgetAmount: number
}

export default function BudgetingPage() {
  const { transactions, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const revSources = useMemo(() => calcRevenueBySource(filtered), [filtered])
  const expCats = useMemo(() => calcExpensesByCategory(filtered), [filtered])
  const printRef = useRef<HTMLDivElement>(null)

  const [budgets, setBudgets] = useState<BudgetRow[]>(() => {
    try { return JSON.parse(localStorage.getItem('ramy-budgets') ?? '[]') } catch { return [] }
  })
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<'revenue' | 'expense'>('revenue')
  const [newAmount, setNewAmount] = useState('')

  const saveBudgets = (b: BudgetRow[]) => {
    setBudgets(b)
    localStorage.setItem('ramy-budgets', JSON.stringify(b))
  }

  const totalBudgetRev = budgets.filter(b => b.type === 'revenue').reduce((s, b) => s + b.budgetAmount, 0)
  const totalBudgetExp = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + b.budgetAmount, 0)
  const totalActualRev = revSources.reduce((s, r) => s + r.amount, 0)
  const totalActualExp = expCats.reduce((s, e) => s + e.amount, 0)

  const getActual = (row: BudgetRow) => {
    if (row.type === 'revenue') {
      const src = revSources.find(r => r.name === row.category)
      return src?.amount ?? 0
    } else {
      const cat = expCats.find(e => e.name === row.category)
      return cat?.amount ?? 0
    }
  }

  const addRow = () => {
    if (!newLabel.trim() || !newAmount) return
    saveBudgets([...budgets, { id: Date.now().toString(), category: newLabel.trim(), type: newType, budgetAmount: parseFloat(newAmount) || 0 }])
    setNewLabel(''); setNewAmount('')
  }

  const budgetExcelSheets = useMemo(() => [{
    name: 'الميزانية',
    data: [
      ['النوع', 'البند', 'المستهدف', 'الفعلي', 'الفرق', 'نسبة الإنجاز'],
      ...budgets.map(row => {
        const actual = row.type === 'revenue'
          ? (revSources.find(r => r.name === row.category)?.amount ?? 0)
          : (expCats.find(e => e.name === row.category)?.amount ?? 0)
        const diff = actual - row.budgetAmount
        const pct = row.budgetAmount > 0 ? (actual / row.budgetAmount) * 100 : 0
        return [row.type === 'revenue' ? 'إيراد' : 'مصروف', row.category, row.budgetAmount, actual, diff, `${pct.toFixed(1)}%`]
      }),
      [],
      ['إجمالي الإيرادات المستهدفة', totalBudgetRev, '', totalActualRev, totalActualRev - totalBudgetRev, ''],
      ['إجمالي المصروفات المستهدفة', totalBudgetExp, '', totalActualExp, totalActualExp - totalBudgetExp, ''],
    ] as (string | number | null)[][]
  }], [budgets, revSources, expCats, totalBudgetRev, totalBudgetExp, totalActualRev, totalActualExp])

  return (
    <AppShell title="الميزانية التقديرية">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="ميزانية الإيرادات" value={totalBudgetRev} color="blue" />
          <Kpi label="إيرادات فعلية" value={totalActualRev} color="green" />
          <Kpi label="ميزانية المصروفات" value={totalBudgetExp} color="orange" />
          <Kpi label="مصروفات فعلية" value={totalActualExp} color="red" />
        </div>

        {/* Add row */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">إضافة بند ميزانية</h3>
          <div className="flex gap-3 flex-wrap">
            <select value={newType} onChange={e => setNewType(e.target.value as 'revenue' | 'expense')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="revenue">إيراد</option>
              <option value="expense">مصروف</option>
            </select>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="اسم البند (مثال: مبيعات الشباب)"
              className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
              placeholder="المبلغ المستهدف"
              className="w-44 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button onClick={addRow} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> إضافة
            </button>
          </div>
        </div>

        {/* Variance Chart */}
        {budgets.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">مقارنة الميزانية مقابل الفعلي</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={budgets.map(row => {
                  const actual = row.type === 'revenue'
                    ? (revSources.find(r => r.name === row.category)?.amount ?? 0)
                    : (expCats.find(e => e.name === row.category)?.amount ?? 0)
                  return { label: row.category.length > 12 ? row.category.slice(0, 12) + '…' : row.category, budget: row.budgetAmount, actual, type: row.type }
                })}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [formatCurrency(v as number)]} contentStyle={{ fontFamily: 'Cairo' }} />
                <Legend formatter={(val) => val === 'budget' ? 'المستهدف' : 'الفعلي'} />
                <Bar dataKey="budget" fill="#94a3b8" name="budget" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="actual" radius={[3, 3, 0, 0]}
                  fill="#10b981"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Budget Table */}
        <div id="budgeting-export-area" ref={printRef} className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">الميزانية التقديرية مقابل الفعلي</h3>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg">
                <Printer className="w-4 h-4" /> طباعة
              </button>
              <ExportButton exportId="budgeting-export-area" filename={`ميزانية-${period.label}`} excelSheets={budgetExcelSheets} />
            </div>
          </div>

          {budgets.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-base mb-2">لا توجد بنود ميزانية بعد</p>
              <p className="text-sm">أضف بنود الميزانية من الأعلى</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs">
                    <th className="text-right pb-3">النوع</th>
                    <th className="text-right pb-3">البند</th>
                    <th className="text-left pb-3">المستهدف</th>
                    <th className="text-left pb-3">الفعلي</th>
                    <th className="text-left pb-3">الفرق</th>
                    <th className="text-left pb-3">نسبة الإنجاز</th>
                    <th className="text-left pb-3">التقدم</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((row) => {
                    const actual = getActual(row)
                    const diff = actual - row.budgetAmount
                    const pct = row.budgetAmount > 0 ? Math.min((actual / row.budgetAmount) * 100, 200) : 0
                    const isOver = row.type === 'expense' ? actual > row.budgetAmount : false
                    const isGood = row.type === 'revenue' ? actual >= row.budgetAmount : actual <= row.budgetAmount

                    return (
                      <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', row.type === 'revenue' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                            {row.type === 'revenue' ? 'إيراد' : 'مصروف'}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-gray-800">{row.category}</td>
                        <td className="py-2.5 text-left text-gray-700">{formatCurrency(row.budgetAmount)}</td>
                        <td className="py-2.5 text-left text-gray-900 font-medium">{formatCurrency(actual)}</td>
                        <td className="py-2.5 text-left">
                          <span className={cn('text-sm font-medium', diff >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                            {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                          </span>
                        </td>
                        <td className="py-2.5 text-left">
                          <span className={cn('text-sm font-bold', isGood ? 'text-emerald-600' : 'text-red-600')}>
                            {pct.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2.5 text-left w-36">
                          <div className="bg-gray-100 rounded-full h-2 w-32">
                            <div className={cn('h-2 rounded-full transition-all', isOver ? 'bg-red-500' : isGood ? 'bg-emerald-500' : 'bg-orange-400')}
                              style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </td>
                        <td className="py-2.5">
                          <button onClick={() => saveBudgets(budgets.filter(b => b.id !== row.id))}
                            className="text-gray-300 hover:text-red-400 text-xs">حذف</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Budget from actuals */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-2">إضافة سريعة من بيانات الفترة الحالية</h3>
          <p className="text-gray-400 text-xs mb-4">أضف الفئات الموجودة في البيانات كميزانية تقديرية بنسبة تحديد منها</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {revSources.slice(0, 6).map(src => (
              <button key={src.name}
                onClick={() => {
                  if (budgets.find(b => b.category === src.name)) return
                  saveBudgets([...budgets, { id: Date.now().toString(), category: src.name, type: 'revenue', budgetAmount: src.amount }])
                }}
                className="text-right text-xs border border-gray-200 rounded-lg px-3 py-2 hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                <p className="text-gray-700 font-medium truncate">{src.name}</p>
                <p className="text-emerald-600">{formatCurrency(src.amount)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Kpi({ label, value, color }: { label: string; value: number; color: 'green' | 'red' | 'blue' | 'orange' }) {
  const colors = { green: 'text-emerald-600 bg-emerald-50 border-emerald-100', red: 'text-red-600 bg-red-50 border-red-100', blue: 'text-blue-600 bg-blue-50 border-blue-100', orange: 'text-orange-600 bg-orange-50 border-orange-100' }
  return (
    <div className={cn('rounded-xl border p-4', colors[color])}>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className={cn('text-xl font-bold', colors[color].split(' ')[0])}>{formatCurrency(value)}</p>
    </div>
  )
}
