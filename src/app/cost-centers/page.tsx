'use client'
import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { calcCostCenters, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

export default function CostCentersPage() {
  const { transactions, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const centers = useMemo(() => calcCostCenters(filtered), [filtered])
  const total = centers.reduce((s, c) => s + c.amount, 0)

  return (
    <AppShell title="تحليل مراكز التكلفة">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-900">إجمالي تكاليف مراكز التكلفة</h3>
            <p className="text-gray-400 text-sm">{centers.length} مركز تكلفة · {period.label}</p>
          </div>
          <span className="text-2xl font-bold text-red-600">{formatCurrency(total)}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">توزيع مراكز التكلفة</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={centers.slice(0, 8)} dataKey="amount" nameKey="name" cx="50%" cy="45%" outerRadius={90}
                  label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {centers.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]} contentStyle={{ fontFamily: 'Cairo' }} />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'Cairo' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">مقارنة مراكز التكلفة</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={centers} layout="vertical" margin={{ right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]} contentStyle={{ fontFamily: 'Cairo' }} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {centers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">تفصيل مراكز التكلفة</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3">#</th>
                  <th className="text-right pb-3">مركز التكلفة</th>
                  <th className="text-left pb-3">التكلفة</th>
                  <th className="text-left pb-3">النسبة</th>
                  <th className="text-left pb-3">عدد الحركات</th>
                  <th className="text-left pb-3">التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2 font-medium text-gray-800">{c.name}</td>
                    <td className="py-2 text-left text-red-500 font-medium">{formatCurrency(c.amount)}</td>
                    <td className="py-2 text-left text-gray-600">{c.percentage.toFixed(1)}%</td>
                    <td className="py-2 text-left text-gray-400">{c.count}</td>
                    <td className="py-2 text-left w-32">
                      <div className="bg-gray-100 rounded-full h-1.5 w-28">
                        <div className="h-1.5 rounded-full" style={{ width: `${c.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </td>
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
