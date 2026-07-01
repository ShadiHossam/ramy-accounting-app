'use client'
import { useFinancialStore } from '@/store/financial-store'
import {
  todayPeriod, thisMonthPeriod, thisYearPeriod, allTimePeriod,
  customPeriod, yearPeriod, monthPeriod, getAvailableYears
} from '@/lib/period-utils'
import { Calendar, ChevronDown, Menu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

interface Props { title: string; onMenuClick: () => void }

export default function Header({ title, onMenuClick }: Props) {
  const { period, setPeriod, transactions } = useFinancialStore()
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const years = getAvailableYears(transactions)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const applyCustom = () => {
    if (customStart && customEnd) {
      setPeriod(customPeriod(new Date(customStart), new Date(customEnd)))
      setOpen(false)
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-gray-600 hover:text-gray-900 p-1 -mr-1 flex-shrink-0"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h2>
      </div>

      <div className="relative flex-shrink-0" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="hidden sm:inline">{period.label}</span>
          <ChevronDown className={cn('w-4 h-4 text-gray-500 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3">
            <div className="space-y-1 mb-3">
              <p className="text-xs font-semibold text-gray-500 px-2 mb-2">فترات سريعة</p>
              {[
                { label: 'اليوم', action: () => setPeriod(todayPeriod()) },
                { label: 'هذا الشهر', action: () => setPeriod(thisMonthPeriod()) },
                { label: 'هذه السنة', action: () => setPeriod(thisYearPeriod()) },
                { label: 'كل الفترات', action: () => setPeriod(allTimePeriod(transactions)) },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={() => { action(); setOpen(false) }}
                  className={cn(
                    'w-full text-right px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors',
                    period.label === label ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'
                  )}
                >{label}</button>
              ))}
            </div>

            {years.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 px-2 mb-2">حسب السنة</p>
                <div className="flex flex-wrap gap-1">
                  {years.map(y => (
                    <button
                      key={y}
                      onClick={() => { setPeriod(yearPeriod(y)); setOpen(false) }}
                      className="px-3 py-1 rounded-lg text-xs bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                    >{y}</button>
                  ))}
                </div>
              </div>
            )}

            {years.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 px-2 mb-2">حسب الشهر</p>
                <div className="grid grid-cols-2 gap-1">
                  {years.slice(0, 2).map(y =>
                    ARABIC_MONTHS.map((m, mi) => (
                      <button
                        key={`${y}-${mi}`}
                        onClick={() => { setPeriod(monthPeriod(y, mi)); setOpen(false) }}
                        className="px-2 py-1 rounded text-xs bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-right"
                      >{m} {y}</button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 px-2 mb-2">فترة مخصصة</p>
              <div className="space-y-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                <button onClick={applyCustom}
                  className="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 transition-colors">
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
