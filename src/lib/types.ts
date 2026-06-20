export interface Transaction {
  date: Date
  account: string
  subAccount: string
  analytical: string
  costCenter: string
  description: string
  amount: number
  id: string // unique key for dedup
}

export type AccountType =
  | 'ايرادات'
  | 'مصروفات'
  | 'مشتريات'
  | 'اصول ثابتة'
  | 'مردودات المبيعات'
  | 'مصلحة الضرائب'

export interface FinancialSummary {
  totalRevenue: number
  salesReturns: number
  netSales: number
  purchases: number
  grossProfit: number
  grossMargin: number
  sellingExpenses: number
  adminExpenses: number
  operatingExpenses: number
  otherExpenses: number
  totalExpenses: number
  taxExpenses: number
  netProfit: number
  netMargin: number
  fixedAssets: number
}

export interface MonthlyData {
  month: string // 'YYYY-MM'
  label: string // 'يناير 2024'
  revenue: number
  expenses: number
  purchases: number
  salesReturns: number
  netProfit: number
  grossProfit: number
  grossMargin: number // %
  netMargin: number   // %
}

export interface BalanceSheetInputs {
  cash: number
  receivables: number
  inventory: number
  capital: number
  shortTermDebt: number
  longTermDebt: number
}

export interface CategoryBreakdown {
  name: string
  amount: number
  percentage: number
  count: number
}

export interface PeriodFilter {
  type: 'day' | 'month' | 'year' | 'quarter' | 'custom'
  startDate: Date
  endDate: Date
  label: string
}

export interface Budget {
  category: string
  subCategory: string
  budgetAmount: number
}

export interface SmartInsights {
  problems: string[]
  suggestions: string[]
  opportunities: string[]
  generatedAt: Date
}
