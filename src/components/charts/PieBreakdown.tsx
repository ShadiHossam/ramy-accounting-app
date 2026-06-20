'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CategoryBreakdown } from '@/lib/types'

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16']

interface Props {
  data: CategoryBreakdown[]
  label?: string
}

export default function PieBreakdown({ data }: Props) {
  const top = data.slice(0, 8)

  if (top.length === 0) return (
    <div className="h-64 flex items-center justify-center text-gray-400">لا توجد بيانات</div>
  )

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={top}
          dataKey="amount"
          nameKey="name"
          cx="50%"
          cy="45%"
          outerRadius={90}
          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip
          formatter={(val) => [`${Number(val).toLocaleString('ar-EG')} ج.م`]}
          contentStyle={{ fontFamily: 'Cairo, sans-serif', borderRadius: '8px' }}
        />
        <Legend
          formatter={(val) => val}
          wrapperStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: '11px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
