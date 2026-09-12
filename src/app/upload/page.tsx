'use client'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseExcelFile, parseOpeningBalanceFile, ParsedAccount, ParsedJournalLine } from '@/lib/excel-parser'
import { useFinancialStore } from '@/store/financial-store'
import { FileSpreadsheet, CheckCircle, AlertCircle, X, RefreshCw, FileUp, Wallet, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

type UploadState = 'idle' | 'parsing' | 'success' | 'error'

export default function UploadPage() {
  const router = useRouter()
  const { entries: existing, dbLoaded, loadFromDB } = useFinancialStore()
  const [journalFile, setJournalFile] = useState<File | null>(null)
  const [openingFile, setOpeningFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<{ accountCount: number; entryCount: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const journalInputRef = useRef<HTMLInputElement>(null)
  const openingInputRef = useRef<HTMLInputElement>(null)

  // This page lives outside AppShell, so on a fresh visit nothing has pulled the saved data yet.
  // Only succeeds for a logged-in user — anonymous uploaders get a 401 and see the generic warning,
  // never the stored entry count.
  useEffect(() => {
    if (!dbLoaded) loadFromDB()
  }, [dbLoaded, loadFromDB])

  const process = useCallback(async () => {
    if (!journalFile) return
    setState('parsing')
    setErrors([])

    try {
      setMessage('جاري قراءة ملف قيود اليومية...')
      const journal = await parseExcelFile(journalFile)

      if (journal.accounts.length === 0 || journal.entries.length === 0) {
        setState('error')
        setMessage('لم يتم العثور على بيانات صالحة في ملف قيود اليومية — تأكد من وجود شيتَي "دليل الحسابات" و"قيود اليومية"')
        setErrors(journal.errors)
        return
      }

      let accounts: ParsedAccount[] = journal.accounts
      let entries: ParsedJournalLine[] = journal.entries
      let allErrors = [...journal.errors]

      if (openingFile) {
        setMessage('جاري قراءة ملف الرصيد الافتتاحي...')
        const opening = await parseOpeningBalanceFile(openingFile, accounts)
        accounts = [...accounts, ...opening.extraAccounts]
        // Opening balance lines come first chronologically — every real transaction accumulates
        // on top of them, exactly like they would in the physical books.
        entries = [...opening.openingLines, ...entries]
        allErrors = [...allErrors, ...opening.errors]
      }

      setMessage('جاري حفظ البيانات في قاعدة البيانات...')

      const res = await fetch('/api/financial-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts,
          entries: entries.map(e => ({ ...e, entryDate: e.entryDate.toISOString(), postingDate: e.postingDate.toISOString() })),
          // Only a freshly-attached opening balance file should evict the previously stored one —
          // a journal-only re-upload must leave it in place.
          replaceOpeningBalance: !!openingFile,
        }),
      })

      if (!res.ok) throw new Error('فشل الاتصال بقاعدة البيانات')

      const { accountCount, entryCount } = await res.json() as { accountCount: number; entryCount: number }

      await loadFromDB()
      setStats({ accountCount, entryCount })

      setState('success')
      setMessage(`تم رفع الملف${openingFile ? 'ين' : ''} بنجاح`)
      setErrors(allErrors.slice(0, 30))

      // Only skip straight to the dashboard when there's nothing to read — any warning (imbalance,
      // unknown account, double-booked opening balance, etc.) needs the user's eyes on it first.
      if (allErrors.length === 0) {
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch {
      setState('error')
      setMessage('حدث خطأ أثناء قراءة الملف أو الاتصال بقاعدة البيانات')
    }
  }, [journalFile, openingFile, loadFromDB, router])

  const pickJournal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setJournalFile(file)
  }
  const pickOpening = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setOpeningFile(file)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">نظام التحليل المالي</h1>
          <p className="text-slate-400">ارفع ملف قيود اليومية، ورصيد افتتاحي اختياري، لبدء التحليل المالي الشامل</p>
        </div>

        {state === 'idle' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
            <p className="text-amber-300 text-sm">
              {existing.length > 0 ? `يوجد ${existing.length.toLocaleString('ar-EG')} حركة محمّلة حالياً. ` : ''}
              رفع ملف قيود يومية جديد سيستبدل كل الحركات المحفوظة حالياً. الرصيد الافتتاحي المحفوظ سابقاً يبقى كما هو ما لم ترفق ملف رصيد افتتاحي جديد، وفي هذه الحالة يتم استبداله بالكامل.
            </p>
          </div>
        )}

        {state === 'idle' && (
          <div className="space-y-3">
            <button onClick={() => journalInputRef.current?.click()}
              className={cn('w-full flex items-center gap-4 border-2 border-dashed rounded-xl p-5 text-right transition-colors',
                journalFile ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 bg-slate-800/50 hover:border-emerald-500')}>
              <input ref={journalInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={pickJournal} />
              <FileUp className={cn('w-8 h-8 flex-shrink-0', journalFile ? 'text-emerald-400' : 'text-slate-500')} />
              <div className="min-w-0">
                <p className="text-white font-semibold">ملف قيود اليومية <span className="text-red-400">*</span></p>
                <p className="text-slate-400 text-sm truncate">{journalFile ? journalFile.name : 'دليل الحسابات + قيود اليومية — مطلوب'}</p>
              </div>
            </button>

            <button onClick={() => openingInputRef.current?.click()}
              className={cn('w-full flex items-center gap-4 border-2 border-dashed rounded-xl p-5 text-right transition-colors',
                openingFile ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 bg-slate-800/50 hover:border-emerald-500')}>
              <input ref={openingInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={pickOpening} />
              <Wallet className={cn('w-8 h-8 flex-shrink-0', openingFile ? 'text-emerald-400' : 'text-slate-500')} />
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold">ملف الرصيد الافتتاحي (اختياري)</p>
                <p className="text-slate-400 text-sm truncate">{openingFile ? openingFile.name : 'شيت "قائمة المركز المالى" — أرصدة الحسابات قبل بداية قيود اليومية'}</p>
              </div>
              {openingFile && (
                <span onClick={(e) => { e.stopPropagation(); setOpeningFile(null); if (openingInputRef.current) openingInputRef.current.value = '' }}
                  className="text-slate-500 hover:text-red-400 flex-shrink-0 p-1">
                  <X className="w-4 h-4" />
                </span>
              )}
            </button>

            <button onClick={process} disabled={!journalFile}
              className="w-full py-3 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-colors">
              رفع ومعالجة الملفات
            </button>

            <button onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-xl font-semibold border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-2">
              <LayoutDashboard className="w-5 h-5" />
              الدخول للنظام بدون رفع
            </button>
          </div>
        )}

        {state !== 'idle' && (
          <div className={cn(
            'border-2 rounded-2xl p-12 text-center',
            state === 'parsing' ? 'border-slate-600 bg-slate-800/50' : '',
            state === 'success' ? 'border-emerald-500 bg-emerald-500/10' : '',
            state === 'error' ? 'border-red-500 bg-red-500/10' : '',
          )}>
            {state === 'parsing' ? (
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
                      <p className="text-emerald-300 text-2xl font-bold">{stats.entryCount.toLocaleString('ar-EG')}</p>
                      <p className="text-emerald-400 text-xs">سطر قيد</p>
                    </div>
                    <div className="bg-blue-500/20 rounded-lg px-4 py-2">
                      <p className="text-blue-300 text-2xl font-bold">{stats.accountCount.toLocaleString('ar-EG')}</p>
                      <p className="text-blue-400 text-xs">حساب في الدليل</p>
                    </div>
                  </div>
                )}
                {errors.length === 0 ? (
                  <p className="text-slate-400 text-sm mt-4">جاري الانتقال للوحة التحكم...</p>
                ) : (
                  <>
                    <p className="text-amber-300 text-sm mt-4">راجع التحذيرات أدناه قبل المتابعة</p>
                    <button onClick={() => router.push('/dashboard')}
                      className="mt-4 px-6 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                      تمام، الانتقال للوحة التحكم
                    </button>
                  </>
                )}
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
        )}

        {errors.length > 0 && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-amber-400 text-sm font-medium mb-2">تحذيرات أثناء القراءة (تم الرفع، لكن راجع هذه الملاحظات على بيانات الملف):</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {errors.map((e, i) => <p key={i} className="text-amber-200 text-xs font-mono">{e}</p>)}
            </div>
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
