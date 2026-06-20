'use client'
import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { calcRevenueByAnalytical, calcExpensesByAnalytical, calcParetoAnalysis, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { cn } from '@/lib/utils'

export default function AgentsPage() {
  const { transactions, period } = useFinancialStore()
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const revByAgent = useMemo(() => calcRevenueByAnalytical(filtered), [filtered])
  const expByAgent = useMemo(() => calcExpensesByAnalytical(filtered), [filtered])
  const pareto = useMemo(() => calcParetoAnalysis(revByAgent), [revByAgent])

  const totalRev = revByAgent.reduce((s, r) => s + r.amount, 0)
  const top80 = pareto.filter(p => p.percentage <= 80)

  return (
    <AppShell title="تحليل المندوبين والجهات (Pareto)">
      <div className="space-y-6">
        {/* Pareto Summary */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-xl p-5 text-white">
          <h3 className="font-semibold mb-1">تحليل باريتو (قاعدة 80/20)</h3>
          <p className="text-indigo-200 text-sm mb-4">
            {top80.length} جهة من أصل {revByAgent.length} تولّد 80% من الإيرادات
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{top80.length}</p>
              <p className="text-indigo-200 text-xs">جهة رئيسية (80% الإيراد)</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{revByAgent.length - top80.length}</p>
              <p className="text-indigo-200 text-xs">جهة ثانوية (20% الإيراد)</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-lg font-bold">{formatCurrency(totalRev)}</p>
              <p className="text-indigo-200 text-xs">إجمالي الإيرادات</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">أعلى 15 جهة إيراداً</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revByAgent.slice(0, 15)} layout="vertical" margin={{ right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}ك`} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString('ar-EG')} ج.م`]} contentStyle={{ fontFamily: 'Cairo' }} />
                <Bar dataKey="amount" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">منحنى باريتو التراكمي</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pareto.slice(0, 20)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-35} textAnchor="end" height={60} />
                <YAxis tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, 'نسبة تراكمية']} contentStyle={{ fontFamily: 'Cairo' }} />
                <Line type="monotone" dataKey="percentage" stroke="#6366f1" strokeWidth={2} dot={false} name="percentage" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Table */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">تفصيل الإيرادات حسب الجهة</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3">#</th>
                  <th className="text-right pb-3">الجهة</th>
                  <th className="text-left pb-3">الإيراد</th>
                  <th className="text-left pb-3">النسبة</th>
                  <th className="text-left pb-3">تراكمي</th>
                  <th className="text-left pb-3">الأهمية</th>
                </tr>
              </thead>
              <tbody>
                {pareto.slice(0, 25).map((r, i) => (
                  <tr key={i} className={cn('border-b border-gray-50 hover:bg-gray-50', r.percentage <= 80 ? 'bg-indigo-50/30' : '')}>
                    <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="py-2 text-left text-emerald-600 font-medium">{formatCurrency(r.amount)}</td>
                    <td className="py-2 text-left text-gray-600">{(r.amount / totalRev * 100).toFixed(1)}%</td>
                    <td className="py-2 text-left text-gray-500">{r.percentage.toFixed(1)}%</td>
                    <td className="py-2 text-left">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', r.percentage <= 80 ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-500')}>
                        {r.percentage <= 80 ? 'أساسية' : 'ثانوية'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Expense Sources */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">أعلى بنود الصرف (تحليلي)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="text-right pb-3">#</th>
                  <th className="text-right pb-3">البند</th>
                  <th className="text-left pb-3">المبلغ</th>
                  <th className="text-left pb-3">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {expByAgent.slice(0, 15).map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="py-2 font-medium text-gray-800">{e.name}</td>
                    <td className="py-2 text-left text-red-500 font-medium">{formatCurrency(e.amount)}</td>
                    <td className="py-2 text-left text-gray-500">{e.percentage.toFixed(1)}%</td>
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
