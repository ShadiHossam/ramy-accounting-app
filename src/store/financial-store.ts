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
  setTransactions: (t: Transaction[]) => void
  addTransactions: (t: Transaction[]) => void
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
      setPeriod: (period) => set({ period }),
      setBudgets: (budgets) => set({ budgets }),
      setInsights: (insights) => set({ insights }),
      setApiKey: (apiKey) => set({ apiKey }),
      setBalanceSheetInputs: (inputs) => set(s => ({ balanceSheetInputs: { ...s.balanceSheetInputs, ...inputs } })),
      clear: () => set({ transactions: [], period: defaultPeriod, insights: null }),
    }),
    {
      name: 'ramy-accounting',
      partialize: (state) => ({
        transactions: state.transactions,
        budgets: state.budgets,
        apiKey: state.apiKey,
        balanceSheetInputs: state.balanceSheetInputs,
      }),
    }
  )
)
