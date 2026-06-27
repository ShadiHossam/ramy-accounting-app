'use client'
import { useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { buildFinancialContext } from '@/lib/financial-engine'
import { yearPeriod, monthPeriod, allTimePeriod, getAvailableYears } from '@/lib/period-utils'
import { PeriodFilter } from '@/lib/types'
import {
  Sparkles, AlertTriangle, Lightbulb, TrendingUp, Loader2,
  RefreshCw, Calendar, CheckCircle, XCircle, AlertCircle, FileText,
} from 'lucide-react'

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

interface KPI {
  name: string
  value: string
  status: 'good' | 'warning' | 'danger'
  comment: string
}

interface Insights {
  period?: string
  summary?: string
  alerts?: string[]
  kpis?: KPI[]
  problems: string[]
  suggestions: string[]
  opportunities: string[]
}

function KpiCard({ kpi }: { kpi: KPI }) {
  const colors = {
    good: { bg: 'bg-emerald-50', border: 'border-emerald-200', value: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-4 h-4 text-emerald-500" /> },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', value: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="w-4 h-4 text-amber-500" /> },
    danger: { bg: 'bg-red-50', border: 'border-red-200', value: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: <XCircle className="w-4 h-4 text-red-500" /> },
  }
  const c = colors[kpi.status] ?? colors.warning
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 font-medium">{kpi.name}</span>
        {c.icon}
      </div>
      <div className={`text-xl font-bold ${c.value}`}>{kpi.value}</div>
      <p className="text-xs text-gray-500 leading-relaxed">{kpi.comment}</p>
    </div>
  )
}

export default function AIInsightsPage() {
  const { transactions } = useFinancialStore()
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const [periodMode, setPeriodMode] = useState<'all' | 'year' | 'month'>('all')
  const [selYear, setSelYear] = useState<number>(new Date().getFullYear())
  const [selMonth, setSelMonth] = useState<number>(new Date().getMonth())

  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions])

  const localPeriod: PeriodFilter = useMemo(() => {
    if (periodMode === 'year') return yearPeriod(selYear)
    if (periodMode === 'month') return monthPeriod(selYear, selMonth)
    return allTimePeriod(transactions)
  }, [periodMode, selYear, selMonth, transactions])

  const generate = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const context = buildFinancialContext(transactions, localPeriod)
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setInsights(data.insights)
      setGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  const noData = transactions.length === 0

  return (
    <AppShell title="تقرير الذكاء الاصطناعي">
      <div className="space-y-5">

        {/* Period Picker */}
        {!noData && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700">
                فترة التحليل: <span className="text-indigo-600">{localPeriod.label}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPeriodMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                كل الفترات
              </button>
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => { setPeriodMode('year'); setSelYear(y) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodMode !== 'all' && selYear === y ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            {periodMode !== 'all' && (
              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
                {ARABIC_MONTHS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => { setPeriodMode('month'); setSelMonth(i) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodMode === 'month' && selMonth === i ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hero CTA */}
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 rounded-2xl p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-300" />
          </div>
          <h2 className="text-xl font-bold mb-2">تحليل AI للبيانات المالية</h2>
          <p className="text-indigo-200 text-sm mb-6 max-w-md mx-auto">
            تقرير مالي شامل يحتوي على ملخص تنفيذي، مؤشرات أداء، تنبيهات عاجلة، ومقترحات قابلة للتنفيذ
          </p>
          {noData ? (
            <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-lg px-4 py-2 text-amber-200 text-sm">
              لا توجد بيانات محمّلة — ارفع ملف Excel أولاً
            </div>
          ) : (
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/30 text-sm"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" />جاري التحليل...</>
              ) : generated ? (
                <><RefreshCw className="w-5 h-5" />إعادة التحليل</>
              ) : (
                <><Sparkles className="w-5 h-5" />توليد التقرير</>
              )}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-5 animate-pulse">
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                  <div className="h-5 bg-gray-100 rounded w-1/2" />
                  {[...Array(4)].map((_, j) => <div key={j} className="h-4 bg-gray-100 rounded" />)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== RESULTS ===== */}
        {insights && !loading && (
          <div className="space-y-5">

            {/* Period label */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>تقرير الفترة: <strong className="text-indigo-700">{insights.period || localPeriod.label}</strong></span>
            </div>

            {/* Executive Summary */}
            {insights.summary && (
              <div className="bg-gradient-to-r from-slate-50 to-indigo-50 border border-indigo-100 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-semibold text-gray-800 text-sm">الملخص التنفيذي</h3>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{insights.summary}</p>
              </div>
            )}

            {/* Alerts */}
            {insights.alerts && insights.alerts.length > 0 && (
              <div className="space-y-2">
                {insights.alerts.map((alert, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm leading-relaxed font-medium">{alert}</p>
                  </div>
                ))}
              </div>
            )}

            {/* KPIs */}
            {insights.kpis && insights.kpis.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">مؤشرات الأداء الرئيسية</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {insights.kpis.map((kpi, i) => <KpiCard key={i} kpi={kpi} />)}
                </div>
              </div>
            )}

            {/* 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Problems */}
              <div className="bg-white rounded-xl border border-red-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900">مشاكل وتحديات</h3>
                </div>
                <ul className="space-y-4">
                  {insights.problems.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                      <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suggestions */}
              <div className="bg-white rounded-xl border border-blue-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900">مقترحات تحسين</h3>
                </div>
                <ul className="space-y-4">
                  {insights.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                      <span className="text-blue-400 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Opportunities */}
              <div className="bg-white rounded-xl border border-emerald-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900">فرص نمو</h3>
                </div>
                <ul className="space-y-4">
                  {insights.opportunities.map((o, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                      <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        )}

        {/* Placeholder */}
        {!insights && !loading && !error && !noData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[
              { icon: AlertTriangle, color: 'red', label: 'مشاكل وتحديات' },
              { icon: Lightbulb, color: 'blue', label: 'مقترحات تحسين' },
              { icon: TrendingUp, color: 'emerald', label: 'فرص نمو' },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className={`bg-white rounded-xl border border-${color}-100 p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 bg-${color}-100 rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 text-${color}-500`} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{label}</h3>
                </div>
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-50 rounded border border-dashed border-gray-200" />
                  ))}
                </div>
                <p className="text-gray-300 text-xs text-center mt-4">اضغط توليد التقرير</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </AppShell>
  )
}
