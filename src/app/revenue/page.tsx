'use client'
import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import PieBreakdown from '@/components/charts/PieBreakdown'
import { useFinancialStore } from '@/store/financial-store'
import { calcRevenueBySource, calcRevenueByAnalytical, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16']

export default function RevenuePage() {
  const { transactions, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const bySrc = useMemo(() => calcRevenueBySource(filtered), [filtered])
  const byAgent = useMemo(() => calcRevenueByAnalytical(filtered), [filtered])

  const totalRevenue = bySrc.reduce((s, r) => s + r.amount, 0)

  return (
    <AppShell title="تحليل الإيرادات ومصادر الدخل">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900">إجمالي الإيرادات</h3>
            <span className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</span>
          </div>
          <p className="text-gray-400 text-sm">{period.label}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">توزيع مصادر الدخل (الحساب الفرعي)</h3>
            <PieBreakdown data={bySrc} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">أعلى 10 مصادر إيراد</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySrc.slice(0, 10)} layout="vertical" margin={{ right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} width={120} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]} contentStyle={{ fontFamily: 'Cairo' }} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {bySrc.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">تفصيل مصادر الدخل</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3 font-medium">#</th>
                  <th className="text-right pb-3 font-medium">المصدر</th>
                  <th className="text-left pb-3 font-medium">الإجمالي</th>
                  <th className="text-left pb-3 font-medium">النسبة</th>
                  <th className="text-left pb-3 font-medium">عدد الحركات</th>
                  <th className="text-left pb-3 font-medium pb-3">التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {bySrc.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400 w-8">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-800">{r.name}</td>
                    <td className="py-2.5 text-left text-emerald-600 font-medium">{formatCurrency(r.amount)}</td>
                    <td className="py-2.5 text-left text-gray-600">{r.percentage.toFixed(1)}%</td>
                    <td className="py-2.5 text-left text-gray-500">{r.count.toLocaleString('ar-EG')}</td>
                    <td className="py-2.5 text-left w-32">
                      <div className="bg-gray-100 rounded-full h-1.5 w-28">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${r.percentage}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">أعلى جهات/مندوبين إيراداً (تحليلي)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3 font-medium">#</th>
                  <th className="text-right pb-3 font-medium">الجهة / المندوب</th>
                  <th className="text-left pb-3 font-medium">الإيراد</th>
                  <th className="text-left pb-3 font-medium">النسبة</th>
                  <th className="text-left pb-3 font-medium">التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {byAgent.slice(0, 15).map((a, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400 w-8">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-800">{a.name}</td>
                    <td className="py-2.5 text-left text-emerald-600 font-medium">{formatCurrency(a.amount)}</td>
                    <td className="py-2.5 text-left text-gray-600">{a.percentage.toFixed(1)}%</td>
                    <td className="py-2.5 text-left w-32">
                      <div className="bg-gray-100 rounded-full h-1.5 w-28">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${a.percentage}%` }} />
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
