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

export function allTimePeriod(transactions: { date: Date }[]): PeriodFilter {
  if (transactions.length === 0) {
    return { type: 'custom', startDate: new Date(2020, 0, 1), endDate: new Date(), label: 'كل الفترات' }
  }
  const dates = transactions.map(t => new Date(t.date).getTime())
  return {
    type: 'custom',
    startDate: new Date(Math.min(...dates)),
    endDate: new Date(Math.max(...dates)),
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

export function getAvailableYears(transactions: { date: Date }[]): number[] {
  const years = new Set(transactions.map(t => new Date(t.date).getFullYear()))
  return Array.from(years).sort((a, b) => b - a)
}
