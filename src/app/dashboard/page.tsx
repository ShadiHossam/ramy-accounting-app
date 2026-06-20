'use client'
import { useMemo, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import SummaryCard from '@/components/cards/SummaryCard'
import RevenueExpensesChart from '@/components/charts/RevenueExpensesChart'
import PieBreakdown from '@/components/charts/PieBreakdown'
import { useFinancialStore } from '@/store/financial-store'
import { calcSummary, calcMonthlyData, calcRevenueBySource, filterByPeriod, formatCurrency } from '@/lib/financial-engine'
import { TrendingUp, TrendingDown, DollarSign, Percent, AlertCircle, Lightbulb, Rocket, RefreshCw, Loader2 } from 'lucide-react'
import { buildFinancialContext } from '@/lib/financial-engine'
import ExportButton from '@/components/ui/ExportButton'

export default function DashboardPage() {
  const router = useRouter()
  const { transactions, period, apiKey, insights, setInsights } = useFinancialStore()
  const insightsLoading = useRef(false)
  const [insightsLoadingState, setInsightsLoadingState] = useState(false)

  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period])
  const summary = useMemo(() => calcSummary(filtered), [filtered])
  const monthly = useMemo(() => calcMonthlyData(filtered), [filtered])
  const revSources = useMemo(() => calcRevenueBySource(filtered), [filtered])

  const recentTransactions = useMemo(() =>
    [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
    [transactions]
  )

  useEffect(() => {
    if (insights || insightsLoading.current || filtered.length === 0) return
    insightsLoading.current = true
    setInsightsLoadingState(true)

    const context = buildFinancialContext(transactions, period)
    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, apiKey: apiKey || undefined }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.insights) setInsights({ ...data.insights, generatedAt: new Date() })
      })
      .finally(() => {
        insightsLoading.current = false
        setInsightsLoadingState(false)
      })
  }, [apiKey, filtered.length, insights, period, setInsights, transactions])

  const dashboardExcelSheets = useMemo(() => [
    {
      name: 'الملخص المالي',
      data: [
        ['الملخص المالي', period.label],
        [],
        ['البند', 'القيمة'],
        ['إجمالي الإيرادات', summary.totalRevenue],
        ['مردودات المبيعات', summary.salesReturns],
        ['صافي المبيعات', summary.netSales],
        ['تكلفة المشتريات', summary.purchases],
        ['مجمل الربح', summary.grossProfit],
        ['هامش الربح الإجمالي', `${summary.grossMargin.toFixed(1)}%`],
        ['إجمالي المصروفات', summary.totalExpenses],
        ['صافي الربح', summary.netProfit],
        ['هامش صافي الربح', `${summary.netMargin.toFixed(1)}%`],
      ] as (string | number | null)[][]
    },
    {
      name: 'البيانات الشهرية',
      data: [
        ['الشهر', 'الإيرادات', 'المصروفات', 'صافي الربح'],
        ...monthly.map(m => [m.label, m.revenue, m.expenses, m.netProfit]),
      ] as (string | number | null)[][]
    },
  ], [summary, monthly, period.label])

  if (transactions.length === 0) {
    return (
      <AppShell title="لوحة التحكم">
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-xl font-medium mb-2">لا توجد بيانات</p>
          <p className="text-sm mb-6">ارفع ملف Excel لبدء التحليل</p>
          <button onClick={() => router.push('/upload')} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-emerald-700">
            رفع ملف
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="لوحة التحكم">
      <div id="dashboard-export-area" className="space-y-6">
        <div className="flex justify-end">
          <ExportButton exportId="dashboard-export-area" filename={`لوحة-التحكم-${period.label}`} excelSheets={dashboardExcelSheets} />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="إجمالي الإيرادات" value={summary.totalRevenue} icon={TrendingUp} color="green" />
          <SummaryCard title="إجمالي المصروفات" value={summary.totalExpenses} icon={TrendingDown} color="red" />
          <SummaryCard title="صافي الربح" value={summary.netProfit} icon={DollarSign} color={summary.netProfit >= 0 ? 'blue' : 'red'} />
          <SummaryCard title="هامش صافي الربح" value={summary.netMargin} icon={Percent} color="purple" isPercent isCurrency={false}
            subtitle={`هامش إجمالي: ${summary.grossMargin.toFixed(1)}%`} />
        </div>

        {/* Smart Insights */}
        <SmartInsightsPanel insights={insights} apiKey={apiKey} loading={insightsLoadingState} onRefresh={() => {
          setInsights({ problems: [], suggestions: [], opportunities: [], generatedAt: new Date() })
        }} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">الإيرادات والمصروفات والربح الشهري</h3>
            <RevenueExpensesChart data={monthly} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">توزيع مصادر الإيراد</h3>
            <PieBreakdown data={revSources} />
          </div>
        </div>

        {/* P&L Quick View */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">ملخص قائمة الدخل</h3>
          <div className="space-y-2">
            {[
              { label: 'إجمالي الإيرادات', value: summary.totalRevenue, indent: false, bold: false, color: 'text-emerald-600' },
              { label: 'مردودات المبيعات', value: -summary.salesReturns, indent: true, bold: false, color: 'text-red-500' },
              { label: 'صافي المبيعات', value: summary.netSales, indent: false, bold: true, color: 'text-gray-900' },
              { label: 'تكلفة المشتريات', value: -summary.purchases, indent: true, bold: false, color: 'text-red-500' },
              { label: 'مجمل الربح', value: summary.grossProfit, indent: false, bold: true, color: summary.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
              { label: 'إجمالي المصروفات', value: -summary.totalExpenses, indent: true, bold: false, color: 'text-red-500' },
              { label: 'صافي الربح', value: summary.netProfit, indent: false, bold: true, color: summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700' },
            ].map((row, i) => (
              <div key={i} className={`flex justify-between items-center py-2 border-b border-gray-50 ${row.indent ? 'pr-6' : ''} ${row.bold ? 'border-t border-gray-200 mt-1 pt-2' : ''}`}>
                <span className={`text-sm ${row.bold ? 'font-bold' : 'text-gray-600'}`}>{row.label}</span>
                <span className={`text-sm font-medium ${row.color}`}>{formatCurrency(Math.abs(row.value))}{row.value < 0 ? ' (-)' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">آخر 10 حركات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-100">
                  <th className="text-right pb-2 font-medium">التاريخ</th>
                  <th className="text-right pb-2 font-medium">الحساب</th>
                  <th className="text-right pb-2 font-medium">الحساب الفرعي</th>
                  <th className="text-right pb-2 font-medium">البيان</th>
                  <th className="text-left pb-2 font-medium">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 text-gray-500">{new Date(t.date).toLocaleDateString('ar-EG')}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.account === 'ايرادات' ? 'bg-emerald-50 text-emerald-700' : t.account === 'مصروفات' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t.account}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600 text-xs">{t.subAccount}</td>
                    <td className="py-2 text-gray-700 max-w-[200px] truncate">{t.description}</td>
                    <td className="py-2 text-left font-medium text-gray-900">{t.amount.toLocaleString('ar-EG')} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function SmartInsightsPanel({ insights, apiKey, loading, onRefresh }: {
  insights: { problems: string[]; suggestions: string[]; opportunities: string[]; generatedAt: Date } | null
  apiKey: string
  loading: boolean
  onRefresh: () => void
}) {
  if (!apiKey) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <p className="text-amber-700 text-sm">
          أضف مفتاح Anthropic API من <a href="/settings" className="underline font-medium">الإعدادات</a> لتفعيل تقرير الذكاء الاصطناعي التلقائي
        </p>
      </div>
    )
  }

  if (!insights || loading) {
    return (
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
        <p className="text-purple-700 text-sm font-medium">الذكاء الاصطناعي يحلل بياناتك ويجهز التقرير...</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-purple-500 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold">AI</span>
          </div>
          <h3 className="font-semibold">تقرير الذكاء الاصطناعي</h3>
          <span className="text-slate-400 text-xs">{new Date(insights.generatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <button onClick={onRefresh} className="text-slate-400 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.problems.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <h4 className="text-red-300 text-sm font-semibold">مشاكل</h4>
            </div>
            <ul className="space-y-2">
              {insights.problems.map((p, i) => <li key={i} className="text-slate-300 text-xs leading-relaxed">• {p}</li>)}
            </ul>
          </div>
        )}
        {insights.suggestions.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <h4 className="text-yellow-300 text-sm font-semibold">مقترحات</h4>
            </div>
            <ul className="space-y-2">
              {insights.suggestions.map((s, i) => <li key={i} className="text-slate-300 text-xs leading-relaxed">• {s}</li>)}
            </ul>
          </div>
        )}
        {insights.opportunities.length > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Rocket className="w-4 h-4 text-emerald-400" />
              <h4 className="text-emerald-300 text-sm font-semibold">فرص نمو</h4>
            </div>
            <ul className="space-y-2">
              {insights.opportunities.map((o, i) => <li key={i} className="text-slate-300 text-xs leading-relaxed">• {o}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
