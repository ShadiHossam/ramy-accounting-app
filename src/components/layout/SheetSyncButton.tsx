'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useFinancialStore } from '@/store/financial-store'
import { cn } from '@/lib/utils'

interface SyncStatus {
  configured: boolean
  lastCheckedAt: string | null
  lastSyncedAt: string | null
  ok: boolean
  message: string
  warnings: string[]
}

function ago(iso: string | null): string {
  if (!iso) return 'لم تتم بعد'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'الآن'
  if (min < 60) return `منذ ${min} دقيقة`
  const h = Math.round(min / 60)
  if (h < 24) return `منذ ${h} ساعة`
  return new Date(iso).toLocaleDateString('ar-EG')
}

// Shows when the data was last pulled from the client's Google Sheet and lets them pull it now.
export default function SheetSyncButton() {
  const loadFromDB = useFinancialStore(s => s.loadFromDB)
  const [status, setStatus] = useState<SyncStatus | null>(null)
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
    const id = setInterval(refresh, 60_000)
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => { clearInterval(id); document.removeEventListener('mousedown', close) }
  }, [refresh])

  const syncNow = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/sheet-sync', { method: 'POST' })
      if (res.ok) {
        const s = await res.json() as SyncStatus
        setStatus(s)
        if (s.ok) await loadFromDB()
      }
    } finally {
      setBusy(false)
      setOpen(true)
    }
  }

  if (!status?.configured) return null
  const warn = !status.ok || status.warnings.length > 0

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => (busy ? null : setOpen(!open))}
        className={cn('flex items-center gap-2 border rounded-lg px-2.5 sm:px-3 py-2 text-sm font-medium transition-colors',
          warn ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')}>
        <RefreshCw className={cn('w-4 h-4', busy && 'animate-spin')} />
        <span className="hidden md:inline">{busy ? 'جاري المزامنة...' : `آخر تحديث: ${ago(status.lastCheckedAt)}`}</span>
        {warn && !busy && <AlertTriangle className="w-4 h-4 text-amber-600" />}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 text-sm space-y-3">
          <p className="font-semibold text-gray-900">المزامنة مع شيت جوجل</p>
          <p className="text-gray-600">البيانات بتتحدث تلقائياً من الشيت كل ١٥ دقيقة.</p>
          <div className="text-gray-600 space-y-1">
            <p>آخر فحص: {ago(status.lastCheckedAt)}</p>
            <p>آخر تغيير في البيانات: {ago(status.lastSyncedAt)}</p>
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
          <button onClick={syncNow} disabled={busy}
            className="w-full py-2 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 text-white flex items-center justify-center gap-2">
            <RefreshCw className={cn('w-4 h-4', busy && 'animate-spin')} />
            {busy ? 'جاري المزامنة...' : 'مزامنة الآن'}
          </button>
        </div>
      )}
    </div>
  )
}
