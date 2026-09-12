'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Account, JournalLine, PeriodFilter, Budget, SmartInsights } from '@/lib/types'
import { allTimePeriod } from '@/lib/period-utils'

interface FinancialStore {
  accounts: Account[]
  entries: JournalLine[]
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
      accounts: [],
      entries: [],
      period: defaultPeriod,
      budgets: [],
      insights: null,
      dbLoaded: false,
      loadFromDB: async () => {
        try {
          const res = await fetch('/api/financial-data')
          // Not logged in (e.g. an anonymous uploader on /upload) — expected, not an error.
          if (res.status === 401) return
          if (!res.ok) throw new Error(`فشل تحميل البيانات (${res.status})`)
          const { accounts, entries } = await res.json() as {
            accounts: Account[]
            entries: Array<Omit<JournalLine, 'entryDate' | 'postingDate'> & { entryDate: string; postingDate: string }>
          }
          const parsedEntries = entries.map(e => ({ ...e, entryDate: new Date(e.entryDate), postingDate: new Date(e.postingDate) }))
          const period = parsedEntries.length > 0 ? allTimePeriod(parsedEntries) : defaultPeriod
          set({ accounts, entries: parsedEntries, period, dbLoaded: true })
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
        set({ accounts: [], entries: [], period: defaultPeriod, insights: null, dbLoaded: true })
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
