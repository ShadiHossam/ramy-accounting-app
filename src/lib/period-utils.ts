import { PeriodFilter } from './types'

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

export function todayPeriod(): PeriodFilter {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  return { type: 'day', startDate: start, endDate: end, label: 'اليوم' }
}

export function thisMonthPeriod(): PeriodFilter {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return {
    type: 'month', startDate: start, endDate: end,
    label: `${ARABIC_MONTHS[now.getMonth()]} ${now.getFullYear()}`
  }
}

export function thisYearPeriod(): PeriodFilter {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  return { type: 'year', startDate: start, endDate: end, label: `سنة ${now.getFullYear()}` }
}

export function allTimePeriod(metrics: { year: number; month: number }[]): PeriodFilter {
  if (metrics.length === 0) {
    return { type: 'custom', startDate: new Date(2020, 0, 1), endDate: new Date(), label: 'كل الفترات' }
  }
  const keys = metrics.map(m => m.year * 12 + (m.month - 1))
  const minKey = Math.min(...keys)
  const maxKey = Math.max(...keys)
  return {
    type: 'custom',
    startDate: new Date(Math.floor(minKey / 12), minKey % 12, 1),
    endDate: new Date(Math.floor(maxKey / 12), (maxKey % 12) + 1, 0, 23, 59, 59),
    label: 'كل الفترات'
  }
}

export function customPeriod(start: Date, end: Date): PeriodFilter {
  const fmt = (d: Date) => `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return { type: 'custom', startDate: start, endDate: end, label: `${fmt(start)} - ${fmt(end)}` }
}

export function yearPeriod(year: number): PeriodFilter {
  return {
    type: 'year',
    startDate: new Date(year, 0, 1),
    endDate: new Date(year, 11, 31, 23, 59, 59),
    label: `سنة ${year}`
  }
}

export function monthPeriod(year: number, month: number): PeriodFilter {
  return {
    type: 'month',
    startDate: new Date(year, month, 1),
    endDate: new Date(year, month + 1, 0, 23, 59, 59),
    label: `${ARABIC_MONTHS[month]} ${year}`
  }
}

export function getAvailableYears(metrics: { year: number }[]): number[] {
  const years = new Set(metrics.map(m => m.year))
  return Array.from(years).sort((a, b) => b - a)
}

// Local (not UTC) YYYY-MM-DD key — transaction dates are stored at local midnight,
// so grouping/deduping must use local date parts too or dates shift by a day near UTC boundaries.
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Parses a "YYYY-MM-DD" string (e.g. from <input type="date">) as local midnight,
// matching how transaction dates are parsed — new Date(str) would parse it as UTC instead.
export function parseLocalDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}
