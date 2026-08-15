export type SheetName = 'مصروفات' | 'ورقة2' | 'دخل'

export interface MonthlyMetric {
  id: string
  sheet: SheetName
  category: string
  year: number
  month: number // 1-12
  amount: number
}

export type BalanceSheetSection = 'assets' | 'liabilities' | 'equity'

export interface BalanceSheetLine {
  id: string
  label: string
  code: string | null
  section: BalanceSheetSection
  isTotal: boolean
  amount: number
  asOfDate: Date
}

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

export interface SmartInsightKpi {
  name: string
  value: string
  status: 'good' | 'warning' | 'danger'
  comment: string
}

export interface SmartInsights {
  period?: string
  summary?: string
  alerts?: string[]
  kpis?: SmartInsightKpi[]
  problems: string[]
  suggestions: string[]
  opportunities: string[]
  generatedAt: Date
}
