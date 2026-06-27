'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Transaction, PeriodFilter, Budget, SmartInsights, BalanceSheetInputs } from '@/lib/types'
import { allTimePeriod } from '@/lib/period-utils'

const defaultBalanceSheetInputs: BalanceSheetInputs = {
  cash: 0,
  receivables: 0,
  inventory: 0,
  capital: 0,
  shortTermDebt: 0,
  longTermDebt: 0,
}

interface FinancialStore {
  transactions: Transaction[]
  period: PeriodFilter
  budgets: Budget[]
  insights: SmartInsights | null
  apiKey: string
  balanceSheetInputs: BalanceSheetInputs
  dbLoaded: boolean
  setTransactions: (t: Transaction[]) => void
  addTransactions: (t: Transaction[]) => void
  loadFromDB: () => Promise<void>
  setPeriod: (p: PeriodFilter) => void
  setBudgets: (b: Budget[]) => void
  setInsights: (i: SmartInsights) => void
  setApiKey: (key: string) => void
  setBalanceSheetInputs: (inputs: Partial<BalanceSheetInputs>) => void
  clear: () => void
}

const defaultPeriod: PeriodFilter = {
  type: 'custom',
  startDate: new Date(2020, 0, 1),
  endDate: new Date(),
  label: 'كل الفترات'
}

export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set, get) => ({
      transactions: [],
      period: defaultPeriod,
      budgets: [],
      insights: null,
      apiKey: '',
      balanceSheetInputs: defaultBalanceSheetInputs,
      dbLoaded: false,
      setTransactions: (transactions) => {
        const period = allTimePeriod(transactions)
        set({ transactions, period, insights: null })
      },
      addTransactions: (incoming) => {
        const existing = get().transactions
        const existingIds = new Set(existing.map(t => t.id))
        const newOnes = incoming.filter(t => !existingIds.has(t.id))
        const merged = [...existing, ...newOnes]
        set({ transactions: merged, insights: null })
      },
      loadFromDB: async () => {
        const res = await fetch('/api/transactions')
        const { transactions } = await res.json() as { transactions: Array<{ id: string; date: string; account: string; subAccount: string; analytical: string; costCenter: string; description: string; amount: number }> }
        const parsed = transactions.map(t => ({ ...t, date: new Date(t.date) }))
        const period = parsed.length > 0 ? allTimePeriod(parsed) : defaultPeriod
        set({ transactions: parsed, period, dbLoaded: true })
      },
      setPeriod: (period) => set({ period }),
      setBudgets: (budgets) => set({ budgets }),
      setInsights: (insights) => set({ insights }),
      setApiKey: (apiKey) => set({ apiKey }),
      setBalanceSheetInputs: (inputs) => set(s => ({ balanceSheetInputs: { ...s.balanceSheetInputs, ...inputs } })),
      clear: () => set({ transactions: [], period: defaultPeriod, insights: null, dbLoaded: false }),
    }),
    {
      name: 'ramy-accounting',
      partialize: (state) => ({
        budgets: state.budgets,
        apiKey: state.apiKey,
        balanceSheetInputs: state.balanceSheetInputs,
      }),
    }
  )
)
