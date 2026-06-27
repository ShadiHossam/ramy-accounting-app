'use client'
import { useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseExcelFile } from '@/lib/excel-parser'
import { useFinancialStore } from '@/store/financial-store'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type UploadState = 'idle' | 'dragging' | 'parsing' | 'success' | 'error'

export default function UploadPage() {
  const router = useRouter()
  const { transactions: existing, loadFromDB } = useFinancialStore()
  const [state, setState] = useState<UploadState>('idle')
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<{ newCount: number; dupCount: number; total: number; skippedRows: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [mergeMode, setMergeMode] = useState<'replace' | 'merge'>('merge')
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setState('error')
      setMessage('الملف يجب أن يكون Excel (.xlsx أو .xls)')
      return
    }

    setState('parsing')
    setMessage('جاري قراءة الملف...')

    try {
      const result = await parseExcelFile(file)

      if (result.transactions.length === 0) {
        setState('error')
        setMessage('لم يتم العثور على بيانات صالحة في الملف')
        setErrors(result.errors)
        return
      }

      setMessage('جاري حفظ البيانات في قاعدة البيانات...')

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: result.transactions, mode: mergeMode }),
      })

      if (!res.ok) throw new Error('فشل الاتصال بقاعدة البيانات')

      const { newCount, dupCount, total } = await res.json() as { newCount: number; dupCount: number; total: number }

      // Reload all transactions from DB into the store
      await loadFromDB()
      setStats({ newCount, dupCount, total, skippedRows: result.skippedRows })

      setState('success')
      setMessage(`تم رفع الملف بنجاح: ${file.name}`)
      setErrors(result.errors.slice(0, 20))

      setTimeout(() => router.push('/dashboard'), 2000)
    } catch {
      setState('error')
      setMessage('حدث خطأ أثناء قراءة الملف أو الاتصال بقاعدة البيانات')
    }
  }, [existing, mergeMode, loadFromDB, router])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">نظام التحليل المالي</h1>
          <p className="text-slate-400">ارفع ملف Excel لبدء التحليل المالي الشامل</p>
        </div>

        {existing.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
            <p className="text-slate-300 text-sm mb-3 font-medium">
              يوجد {existing.length.toLocaleString('ar-EG')} سجل محمّل حالياً. كيف تريد معالجة الملف الجديد؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMergeMode('merge')}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors', mergeMode === 'merge' ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 text-slate-300 hover:border-emerald-500')}
              >إضافة الجديد فقط (موصى)</button>
              <button
                onClick={() => setMergeMode('replace')}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors', mergeMode === 'replace' ? 'bg-red-600 border-red-500 text-white' : 'border-slate-600 text-slate-300 hover:border-red-500')}
              >استبدال كل البيانات</button>
            </div>
          </div>
        )}

        <div
          className={cn(
            'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
            state === 'dragging' ? 'border-emerald-400 bg-emerald-500/10 scale-102' : 'border-slate-600 bg-slate-800/50 hover:border-emerald-500 hover:bg-slate-800',
            state === 'success' ? 'border-emerald-500 bg-emerald-500/10' : '',
            state === 'error' ? 'border-red-500 bg-red-500/10' : '',
          )}
          onDragOver={(e) => { e.preventDefault(); setState('dragging') }}
          onDragLeave={() => setState('idle')}
          onDrop={onDrop}
          onClick={() => state === 'idle' && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileInput} />

          {state === 'idle' || state === 'dragging' ? (
            <>
              <Upload className={cn('w-12 h-12 mx-auto mb-4', state === 'dragging' ? 'text-emerald-400' : 'text-slate-500')} />
              <p className="text-white font-semibold text-lg mb-2">اسحب وأفلت ملف Excel هنا</p>
              <p className="text-slate-400 text-sm mb-4">أو انقر للاختيار من جهازك</p>
              <p className="text-slate-500 text-xs">يدعم: .xlsx و .xls</p>
            </>
          ) : state === 'parsing' ? (
            <>
              <RefreshCw className="w-12 h-12 mx-auto mb-4 text-emerald-400 animate-spin" />
              <p className="text-white font-semibold text-lg">{message}</p>
            </>
          ) : state === 'success' ? (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
              <p className="text-emerald-400 font-semibold text-lg mb-2">{message}</p>
              {stats && (
                <div className="flex justify-center gap-4 mt-3 flex-wrap">
                  <div className="bg-emerald-500/20 rounded-lg px-4 py-2">
                    <p className="text-emerald-300 text-2xl font-bold">{stats.newCount.toLocaleString('ar-EG')}</p>
                    <p className="text-emerald-400 text-xs">سجل جديد</p>
                  </div>
                  {stats.dupCount > 0 && (
                    <div className="bg-slate-700 rounded-lg px-4 py-2">
                      <p className="text-slate-300 text-2xl font-bold">{stats.dupCount.toLocaleString('ar-EG')}</p>
                      <p className="text-slate-400 text-xs">سجل موجود مسبقاً</p>
                    </div>
                  )}
                  <div className="bg-blue-500/20 rounded-lg px-4 py-2">
                    <p className="text-blue-300 text-2xl font-bold">{stats.total.toLocaleString('ar-EG')}</p>
                    <p className="text-blue-400 text-xs">إجمالي السجلات</p>
                  </div>
                  {stats.skippedRows > 0 && (
                    <div className="bg-red-500/20 rounded-lg px-4 py-2">
                      <p className="text-red-300 text-2xl font-bold">{stats.skippedRows.toLocaleString('ar-EG')}</p>
                      <p className="text-red-400 text-xs">صف تعذّر قراءته</p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-slate-400 text-sm mt-4">جاري الانتقال للوحة التحكم...</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <p className="text-red-400 font-semibold text-lg mb-2">{message}</p>
              <button onClick={() => setState('idle')} className="mt-3 text-slate-400 hover:text-white text-sm flex items-center gap-1 mx-auto">
                <X className="w-4 h-4" /> حاول مرة أخرى
              </button>
            </>
          )}
        </div>

        {errors.length > 0 && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-400 text-sm font-medium mb-2">
              صفوف لم تُقرأ ({stats?.skippedRows ?? errors.length} صف) — تحقق من تنسيق التاريخ أو المبلغ:
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {errors.map((e, i) => <p key={i} className="text-red-300 text-xs font-mono">{e}</p>)}
            </div>
            {(stats?.skippedRows ?? 0) > 20 && (
              <p className="text-red-400 text-xs mt-2">... و{((stats?.skippedRows ?? 0) - 20).toLocaleString('ar-EG')} صف آخر</p>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: '📊', title: 'تحليل شامل', desc: 'P&L، ميزانية، تدفق نقدي' },
            { icon: '🤖', title: 'مساعد AI', desc: 'اسأل عن أي رقم بالعربي' },
            { icon: '📄', title: 'تصدير PDF', desc: 'طباعة التقارير بنقرة' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-slate-800/50 rounded-xl p-4">
              <div className="text-2xl mb-2">{icon}</div>
              <p className="text-white text-sm font-medium">{title}</p>
              <p className="text-slate-400 text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
