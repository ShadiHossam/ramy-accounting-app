'use client'
import { useState } from 'react'
import { FileSpreadsheet, AlertCircle, RefreshCw } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error || 'تعذر تسجيل الدخول')
        setLoading(false)
        return
      }

      // Only follow same-site paths, so a crafted ?next= can't bounce the user to another domain.
      const next = new URLSearchParams(window.location.search).get('next')
      // Full navigation (not router.push) so the proxy sees the freshly-set session cookie.
      window.location.assign(next && /^\/(?![/\\])/.test(next) ? next : '/dashboard')
    } catch {
      setError('تعذر الاتصال بالسيرفر')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">نظام التحليل المالي</h1>
          <p className="text-slate-400">سجّل الدخول للمتابعة</p>
        </div>

        <form onSubmit={submit} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-slate-300 text-sm mb-1.5">اسم المستخدم</label>
            <input id="username" dir="ltr" autoComplete="username" required autoFocus
              value={username} onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label htmlFor="password" className="block text-slate-300 text-sm mb-1.5">كلمة المرور</label>
            <input id="password" type="password" dir="ltr" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors flex items-center justify-center gap-2">
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            تسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  )
}
