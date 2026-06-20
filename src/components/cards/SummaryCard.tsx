import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/financial-engine'

interface Props {
  title: string
  value: number
  subtitle?: string
  icon: LucideIcon
  color: 'green' | 'red' | 'blue' | 'purple' | 'orange'
  isCurrency?: boolean
  isPercent?: boolean
  trend?: number
}

const colorMap = {
  green: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', value: 'text-emerald-700', border: 'border-emerald-100' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', value: 'text-red-700', border: 'border-red-100' },
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', value: 'text-blue-700', border: 'border-blue-100' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', value: 'text-purple-700', border: 'border-purple-100' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', value: 'text-orange-700', border: 'border-orange-100' },
}

export default function SummaryCard({ title, value, subtitle, icon: Icon, color, isCurrency = true, isPercent = false, trend }: Props) {
  const c = colorMap[color]
  const displayValue = isPercent ? `${value.toFixed(1)}%` : isCurrency ? formatCurrency(value) : value.toLocaleString('ar-EG')

  return (
    <div className={cn('rounded-xl border p-5 flex items-start gap-4', c.bg, c.border)}>
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', c.icon)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
        <p className={cn('text-2xl font-bold truncate', c.value)}>{displayValue}</p>
        {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <p className={cn('text-xs mt-1 font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% مقارنة بالفترة السابقة
          </p>
        )}
      </div>
    </div>
  )
}
