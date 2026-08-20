export type AccountType = 'أصول' | 'خصوم' | 'حقوق ملكية' | 'إيرادات' | 'مصروفات'

// دليل الحسابات (chart of accounts) — the source of truth for what each account code means.
export interface Account {
  code: number
  name: string
  type: AccountType
  parentCode: number | null
  level: number
}

// One row of قيود اليومية (the journal). This is the raw ledger — every figure shown anywhere
// in the app must trace back to a sum/filter over these rows, never an invented bucket.
export interface JournalLine {
  id: string
  entryNumber: number
  entryDate: Date
  postingDate: Date
  refNumber: string
  docType: string
  description: string
  accountCode: number
  accountName: string
  accountType: AccountType
  costCenter: string
  debit: number
  credit: number
  approvalStatus: string
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

// Only the standard, non-discretionary formula: Net Profit = Revenue - Expenses.
// No gross-profit/selling/admin/operating split — that would require deciding which expense
// account belongs to which bucket, a judgment call the source data doesn't make.
export interface FinancialSummary {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  netMargin: number // % — netProfit / totalRevenue
}

export interface MonthlyData {
  month: string // 'YYYY-MM'
  label: string // 'يناير 2026'
  revenue: number
  expenses: number
  netProfit: number
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
