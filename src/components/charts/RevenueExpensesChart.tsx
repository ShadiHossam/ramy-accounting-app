'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MonthlyData } from '@/lib/types'

interface Props {
  data: MonthlyData[]
}

const formatAmount = (val: number) => {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}م`
  if (val >= 1000) return `${(val / 1000).toFixed(0)}ألف`
  return val.toString()
}

export default function RevenueExpensesChart({ data }: Props) {
  if (data.length === 0) return (
    <div className="h-64 flex items-center justify-center text-gray-400">لا توجد بيانات للعرض</div>
  )

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-30} textAnchor="end" height={50} />
        <YAxis tickFormatter={formatAmount} tick={{ fontSize: 11, fill: '#6b7280' }} />
        <Tooltip
          formatter={(val, name) => [
            `${Number(val).toLocaleString('ar-EG')} ج.م`,
            name === 'revenue' ? 'إيرادات' : name === 'expenses' ? 'مصروفات' : 'صافي ربح'
          ]}
          labelStyle={{ fontFamily: 'Cairo, sans-serif' }}
          contentStyle={{ fontFamily: 'Cairo, sans-serif', borderRadius: '8px' }}
        />
        <Legend formatter={(val) => val === 'revenue' ? 'إيرادات' : val === 'expenses' ? 'مصروفات' : 'صافي ربح'} />
        <Bar dataKey="revenue" name="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
        <Bar dataKey="netProfit" name="netProfit" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
