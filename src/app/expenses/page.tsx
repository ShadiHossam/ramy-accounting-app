'use client'
import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import PieBreakdown from '@/components/charts/PieBreakdown'
import { useFinancialStore } from '@/store/financial-store'
import { calcExpensesByCategory, calcExpensesByAnalytical, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#6366f1', '#06b6d4', '#ec4899', '#10b981', '#14b8a6', '#84cc16']

export default function ExpensesPage() {
  const { transactions, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const byCat = useMemo(() => calcExpensesByCategory(filtered), [filtered])
  const byItem = useMemo(() => calcExpensesByAnalytical(filtered), [filtered])

  const total = byCat.reduce((s, e) => s + e.amount, 0)

  return (
    <AppShell title="تحليل المصروفات">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">إجمالي المصروفات</h3>
            <p className="text-gray-400 text-sm">{period.label}</p>
          </div>
          <span className="text-2xl font-bold text-red-600">{formatCurrency(total)}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">توزيع المصروفات بالفئات</h3>
            <PieBreakdown data={byCat} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">أعلى بنود الصرف</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byItem.slice(0, 10)} layout="vertical" margin={{ right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]} contentStyle={{ fontFamily: 'Cairo' }} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {byItem.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">تفصيل المصروفات بالفئات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3 font-medium">الفئة</th>
                  <th className="text-left pb-3 font-medium">الإجمالي</th>
                  <th className="text-left pb-3 font-medium">النسبة من الإجمالي</th>
                  <th className="text-left pb-3 font-medium">التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {byCat.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-800">{e.name}</td>
                    <td className="py-2.5 text-left text-red-500 font-medium">{formatCurrency(e.amount)}</td>
                    <td className="py-2.5 text-left text-gray-600">{e.percentage.toFixed(1)}%</td>
                    <td className="py-2.5 text-left w-40">
                      <div className="bg-gray-100 rounded-full h-1.5 w-36">
                        <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${e.percentage}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">تفصيل أبواب الصرف (تحليلي)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3 font-medium">#</th>
                  <th className="text-right pb-3 font-medium">البند</th>
                  <th className="text-left pb-3 font-medium">المبلغ</th>
                  <th className="text-left pb-3 font-medium">النسبة</th>
                  <th className="text-left pb-3 font-medium">عدد الحركات</th>
                </tr>
              </thead>
              <tbody>
                {byItem.slice(0, 20).map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2 text-gray-800">{e.name}</td>
                    <td className="py-2 text-left text-red-500 font-medium">{formatCurrency(e.amount)}</td>
                    <td className="py-2 text-left text-gray-500">{e.percentage.toFixed(1)}%</td>
                    <td className="py-2 text-left text-gray-400">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
