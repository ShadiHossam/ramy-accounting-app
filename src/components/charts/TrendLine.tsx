'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { MonthlyData } from '@/lib/types'

interface Props {
  data: MonthlyData[]
  showRevenue?: boolean
  showExpenses?: boolean
  showNetProfit?: boolean
}

const fmt = (val: number) => {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}م`
  if (val >= 1000) return `${(val / 1000).toFixed(0)}ك`
  return val.toString()
}

export default function TrendLine({ data, showRevenue = true, showExpenses = true, showNetProfit = true }: Props) {
  if (data.length === 0) return (
    <div className="h-64 flex items-center justify-center text-gray-400">لا توجد بيانات</div>
  )

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" height={60} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#6b7280' }} />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        <Tooltip
          formatter={(val, name) => [
            `${Number(val).toLocaleString('ar-EG')} ج.م`,
            name === 'revenue' ? 'إيرادات' : name === 'expenses' ? 'مصروفات' : 'صافي ربح'
          ]}
          contentStyle={{ fontFamily: 'Cairo, sans-serif', borderRadius: '8px' }}
        />
        <Legend formatter={(v) => v === 'revenue' ? 'إيرادات' : v === 'expenses' ? 'مصروفات' : 'صافي ربح'} />
        {showRevenue && <Line type="monotone" dataKey="revenue" name="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}
        {showExpenses && <Line type="monotone" dataKey="expenses" name="expenses" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}
        {showNetProfit && <Line type="monotone" dataKey="netProfit" name="netProfit" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}
      </LineChart>
    </ResponsiveContainer>
  )
}
