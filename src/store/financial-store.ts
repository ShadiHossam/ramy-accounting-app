'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MonthlyMetric, BalanceSheetLine, PeriodFilter, Budget, SmartInsights } from '@/lib/types'
import { allTimePeriod } from '@/lib/period-utils'

interface FinancialStore {
  metrics: MonthlyMetric[]
  balanceSheet: BalanceSheetLine[]
  period: PeriodFilter
  budgets: Budget[]
  insights: SmartInsights | null
  dbLoaded: boolean
  loadFromDB: () => Promise<void>
  setPeriod: (p: PeriodFilter) => void
  setBudgets: (b: Budget[]) => void
  setInsights: (i: SmartInsights | null) => void
  clear: () => Promise<void>
}

const defaultPeriod: PeriodFilter = {
  type: 'custom',
  startDate: new Date(2020, 0, 1),
  endDate: new Date(),
  label: 'كل الفترات'
}

export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set) => ({
      metrics: [],
      balanceSheet: [],
      period: defaultPeriod,
      budgets: [],
      insights: null,
      dbLoaded: false,
      loadFromDB: async () => {
        try {
          const res = await fetch('/api/financial-data')
          if (!res.ok) throw new Error(`فشل تحميل البيانات (${res.status})`)
          const { metrics, balanceSheet } = await res.json() as {
            metrics: MonthlyMetric[]
            balanceSheet: Array<Omit<BalanceSheetLine, 'asOfDate'> & { asOfDate: string }>
          }
          const parsedBalanceSheet = balanceSheet.map(b => ({ ...b, asOfDate: new Date(b.asOfDate) }))
          const period = metrics.length > 0 ? allTimePeriod(metrics) : defaultPeriod
          set({ metrics, balanceSheet: parsedBalanceSheet, period, dbLoaded: true })
        } catch (err) {
          // Leave dbLoaded false so AppShell retries loadFromDB the next time it mounts
          // (e.g. navigating to another page), instead of permanently showing "no data".
          console.error('loadFromDB failed:', err)
        }
      },
      setPeriod: (period) => set({ period }),
      setBudgets: (budgets) => set({ budgets }),
      setInsights: (insights) => set({ insights }),
      clear: async () => {
        try {
          await fetch('/api/financial-data', { method: 'DELETE' })
        } catch (err) {
          console.error('Failed to delete financial data from DB:', err)
        }
        set({ metrics: [], balanceSheet: [], period: defaultPeriod, insights: null, dbLoaded: true })
      },
    }),
    {
      name: 'ramy-accounting',
      partialize: (state) => ({
        budgets: state.budgets,
      }),
    }
  )
)
