'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { buildFinancialContext } from '@/lib/financial-engine'
import { Sparkles, AlertTriangle, Lightbulb, TrendingUp, Loader2, RefreshCw } from 'lucide-react'

interface Insights {
  problems: string[]
  suggestions: string[]
  opportunities: string[]
}

export default function AIInsightsPage() {
  const { transactions, period, apiKey } = useFinancialStore()
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const generate = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const context = buildFinancialContext(transactions, period)
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, apiKey: apiKey || undefined }),
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
      <div className="space-y-6">

        {/* Hero / CTA */}
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 rounded-2xl p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-300" />
          </div>
          <h2 className="text-xl font-bold mb-2">تحليل AI للبيانات المالية</h2>
          <p className="text-indigo-200 text-sm mb-6 max-w-md mx-auto">
            اضغط الزر وسيقوم الذكاء الاصطناعي بتحليل بياناتك المالية واستخراج المشاكل والمقترحات والفرص
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
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري التحليل...
                </>
              ) : generated ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  إعادة التحليل
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  توليد التقرير
                </>
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
        {loading && !insights && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-1/2" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-4 bg-gray-100 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {insights && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Problems */}
            <div className="bg-white rounded-xl border border-red-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <h3 className="font-semibold text-gray-900">مشاكل وتحديات</h3>
              </div>
              <ul className="space-y-3">
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
              <ul className="space-y-3">
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
              <ul className="space-y-3">
                {insights.opportunities.map((o, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                    <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}

        {/* Placeholder when nothing generated yet */}
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
                  {[...Array(3)].map((_, i) => (
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
