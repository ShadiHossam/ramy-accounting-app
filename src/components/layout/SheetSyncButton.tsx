'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { useFinancialStore } from '@/store/financial-store'
import { formatLocalDate } from '@/lib/period-utils'
import { cn } from '@/lib/utils'

interface SyncStatus {
  configured: boolean
  lastCheckedAt: string | null
  lastSyncedAt: string | null
  asOf: string | null
  ok: boolean
  message: string
  warnings: string[]
}

const DELETE_CONFIRM = 'حذف كل البيانات من السيستم (الحسابات والقيود والرصيد الافتتاحي)؟\n\nهتقدر تسحبها تاني من الشيت في أي وقت.'

function ago(iso: string | null): string {
  if (!iso) return 'لم يتم بعد'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'الآن'
  if (min < 60) return `منذ ${min} دقيقة`
  const h = Math.round(min / 60)
  if (h < 24) return `منذ ${h} ساعة`
  return new Date(iso).toLocaleDateString('ar-EG')
}

const showDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-')
  return `${Number(d)}/${Number(m)}/${y}`
}

// Pulls the client's Google Sheet on demand, up to and including a chosen date. No automatic sync.
export default function SheetSyncButton() {
  const loadFromDB = useFinancialStore(s => s.loadFromDB)
  const clear = useFinancialStore(s => s.clear)
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [asOf, setAsOf] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/sheet-sync').catch(() => null)
    if (res?.ok) setStatus(await res.json())
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    setAsOf(formatLocalDate(new Date()))
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [refresh])

  const pull = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/sheet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asOf: asOf || null }),
      })
      if (res.ok) {
        const s = await res.json() as SyncStatus
        setStatus(s)
        if (s.ok) await loadFromDB()
      }
    } finally {
      setBusy(false)
    }
  }

  const deleteAll = async () => {
    if (!confirm(DELETE_CONFIRM)) return
    setBusy(true)
    try {
      await clear()
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!status?.configured) return null
  const warn = !status.ok || status.warnings.length > 0

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className={cn('flex items-center gap-2 border rounded-lg px-2.5 sm:px-3 py-2 text-sm font-medium transition-colors',
          warn ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')}>
        <RefreshCw className={cn('w-4 h-4', busy && 'animate-spin')} />
        <span className="hidden md:inline">
          {busy ? 'جاري السحب...' : status.lastSyncedAt ? `البيانات حتى ${status.asOf ? showDate(status.asOf) : 'آخر الشيت'}` : 'سحب من الشيت'}
        </span>
        {warn && !busy && <AlertTriangle className="w-4 h-4 text-amber-600" />}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 text-sm space-y-3">
          <p className="font-semibold text-gray-900">سحب البيانات من شيت جوجل</p>
          <p className="text-gray-600">اختار التاريخ اللي عايز تسحب لحد عنده — السيستم هياخد كل القيود لحد اليوم ده (شامل اليوم نفسه) + الرصيد الافتتاحي. السحب بيستبدل كل البيانات الحالية.</p>

          <label className="block">
            <span className="text-gray-700 font-medium">حتى تاريخ</span>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} disabled={busy}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:border-emerald-500 outline-none" />
          </label>

          <button onClick={pull} disabled={busy || !asOf}
            className="w-full py-2 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 text-white flex items-center justify-center gap-2">
            <RefreshCw className={cn('w-4 h-4', busy && 'animate-spin')} />
            {busy ? 'جاري السحب...' : asOf ? `سحب البيانات حتى ${showDate(asOf)}` : 'اختار تاريخ'}
          </button>

          <div className="text-gray-500 text-xs space-y-0.5 border-t border-gray-100 pt-3">
            <p>آخر سحب: {ago(status.lastSyncedAt)}{status.lastSyncedAt && ` — حتى ${status.asOf ? showDate(status.asOf) : 'آخر الشيت'}`}</p>
          </div>

          {status.message && (
            <p className={cn('flex gap-2', status.ok ? 'text-emerald-700' : 'text-red-600')}>
              {status.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {status.message}
            </p>
          )}
          {status.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="font-medium text-amber-800 mb-1">تحذيرات في الشيت ({status.warnings.length})</p>
              <ul className="list-disc pr-4 text-amber-700 space-y-0.5">
                {status.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <button onClick={deleteAll} disabled={busy}
            className="w-full py-2 rounded-lg font-medium border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 disabled:opacity-50 flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" />
            حذف كل البيانات
          </button>
        </div>
      )}
    </div>
  )
}
