'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/lib/financial-engine'

interface WaterfallItem {
  label: string
  value: number
  type: 'start' | 'positive' | 'negative' | 'total'
}

interface Props {
  totalRevenue: number
  salesReturns: number
  netSales: number
  purchases: number
  grossProfit: number
  totalExpenses: number
  netProfit: number
}

const COLORS = {
  start: '#6366f1',
  positive: '#10b981',
  negative: '#ef4444',
  total: '#0ea5e9',
}

interface ChartDataItem {
  label: string
  base: number
  bar: number
  value: number
  type: 'start' | 'positive' | 'negative' | 'total'
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ChartDataItem }[] }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-right">
      <p className="text-sm font-semibold text-gray-800">{d.label}</p>
      <p className={`text-sm font-bold ${d.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        {d.value >= 0 ? '' : '('}{formatCurrency(Math.abs(d.value))}{d.value < 0 ? ')' : ''}
      </p>
    </div>
  )
}

export default function WaterfallChart({ totalRevenue, salesReturns, netSales, purchases, grossProfit, totalExpenses, netProfit }: Props) {
  const items: WaterfallItem[] = [
    { label: 'الإيرادات', value: totalRevenue, type: 'start' },
    { label: 'مردودات', value: -salesReturns, type: 'negative' },
    { label: 'صافي المبيعات', value: netSales, type: 'total' },
    { label: 'المشتريات', value: -purchases, type: 'negative' },
    { label: 'مجمل الربح', value: grossProfit, type: 'total' },
    { label: 'المصروفات', value: -totalExpenses, type: 'negative' },
    { label: 'صافي الربح', value: netProfit, type: 'total' },
  ]

  // build stacked data: invisible base + visible bar
  let running = 0
  const chartData = items.map(item => {
    const isTotal = item.type === 'total' || item.type === 'start'
    const base = isTotal ? 0 : (item.value >= 0 ? running : running + item.value)
    const bar = Math.abs(item.value)
    if (!isTotal) running += item.value
    else running = item.value
    return { label: item.label, base, bar, value: item.value, type: item.type }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'ك'} tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="bar" stackId="a" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={COLORS[entry.type]} opacity={entry.type === 'negative' ? 0.85 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
