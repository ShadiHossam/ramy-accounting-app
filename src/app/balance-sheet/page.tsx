'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { formatCurrency } from '@/lib/financial-engine'
import { Printer, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BalanceSheetLine, BalanceSheetSection } from '@/lib/types'

// Balance-sheet labels carry stylistic Arabic tatweel (ـ) elongation characters
// (e.g. "الملكــــية") that must be stripped before keyword matching.
const clean = (s: string) => s.replace(/ـ/g, '')

export default function BalanceSheetPage() {
  const router = useRouter()
  const { balanceSheet } = useFinancialStore()

  const latestDate = useMemo(() => {
    if (balanceSheet.length === 0) return null
    return balanceSheet.reduce((max, l) => new Date(l.asOfDate) > new Date(max) ? l.asOfDate : max, balanceSheet[0].asOfDate)
  }, [balanceSheet])

  const lines = useMemo(() =>
    latestDate ? balanceSheet.filter(l => new Date(l.asOfDate).getTime() === new Date(latestDate).getTime()) : [],
    [balanceSheet, latestDate]
  )

  const bySection = (section: BalanceSheetSection) => lines.filter(l => l.section === section)

  // "إجمالي الأصول" specifically — not the "إجمالي الأصول الثابتة/المتداولة" subtotals above it.
  const totalAssetsLine = useMemo(() =>
    bySection('assets').find(l => {
      const c = clean(l.label)
      return l.isTotal && /^(اجمالى|اجمالي)/.test(c) && !c.includes('الثابتة') && !c.includes('المتداولة')
    }),
    [lines]
  )
  // The combined grand-total row (e.g. "إجمالي الالتزامات وحقوق الملكية") is the only line
  // whose label mentions both الالتزامات and حقوق, regardless of which section it parsed into.
  const totalLiabEquityLine = useMemo(() =>
    lines.find(l => clean(l.label).includes('الالتزامات') && clean(l.label).includes('حقوق')),
    [lines]
  )

  const diff = (totalAssetsLine?.amount ?? 0) - (totalLiabEquityLine?.amount ?? 0)

  if (lines.length === 0) {
    return (
      <AppShell title="الميزانية العمومية">
        <div className="flex flex-col items-center justify-center h-96 text-gray-400 bg-white rounded-xl border border-gray-100">
          <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-xl font-medium mb-2">لا توجد بيانات ميزانية</p>
          <p className="text-sm mb-6">ارفع ملف Excel يحتوي على شيت &quot;قائمة المركز المالى&quot;</p>
          <button onClick={() => router.push('/upload')} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-emerald-700">
            رفع ملف
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="الميزانية العمومية">
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center justify-between">
          <p className="text-gray-500 text-sm">كما في {new Date(latestDate!).toLocaleDateString('ar-EG')}</p>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Printer className="w-4 h-4" /> طباعة الميزانية
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4 pb-2 border-b">الأصول</h3>
            <div className="space-y-1">
              {bySection('assets').map((l, i) => <BalRow key={i} line={l} />)}
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4 pb-2 border-b">الالتزامات وحقوق الملكية</h3>
            <div className="space-y-1">
              {bySection('liabilities').map((l, i) => <BalRow key={i} line={l} />)}
              {bySection('equity').map((l, i) => <BalRow key={i} line={l} />)}
            </div>

            {totalAssetsLine && totalLiabEquityLine && (
              Math.abs(diff) > 1 ? (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm font-medium">
                    فرق الميزانية: {formatCurrency(Math.abs(diff))} — البيانات في الملف الأصلي غير متوازنة
                  </p>
                </div>
              ) : (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-emerald-600 text-sm font-medium">✓ الميزانية متوازنة</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function BalRow({ line }: { line: BalanceSheetLine }) {
  return (
    <div className={cn('flex justify-between items-center py-2', line.isTotal ? 'font-bold border-t border-gray-100 mt-1 pt-2' : '')}>
      <span className={cn('text-sm text-gray-700', line.isTotal ? 'font-bold' : '')}>{line.label}</span>
      <span className={cn('text-sm font-medium min-w-[140px] text-left', line.amount >= 0 ? 'text-gray-900' : 'text-red-600')}>
        {formatCurrency(line.amount)}
      </span>
    </div>
  )
}
