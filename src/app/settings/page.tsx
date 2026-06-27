'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { Key, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react'

export default function SettingsPage() {
  const { apiKey, setApiKey, transactions, clear } = useFinancialStore()
  const [inputKey, setInputKey] = useState(apiKey)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [saved, setSaved] = useState(false)

  const testKey = async () => {
    setTesting(true)
    setTestResult('idle')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'مرحباً' }], context: 'اختبار', apiKey: inputKey.trim() || undefined }),
      })
      const data = await res.json()
      setTestResult(data.reply ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  const saveKey = () => {
    setApiKey(inputKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <AppShell title="الإعدادات">
      <div className="max-w-2xl space-y-6">
        {/* API Key */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <Key className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">مفتاح Anthropic API</h3>
              <p className="text-gray-400 text-xs">مطلوب لتفعيل المساعد الذكي وتقرير الإنسايتس</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-purple-400"
            />

            <div className="flex gap-3">
              <button onClick={testKey} disabled={testing}
                className="flex items-center gap-2 border border-gray-200 hover:border-purple-400 hover:text-purple-600 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                اختبار الاتصال
              </button>
              <button onClick={saveKey} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                {saved ? '✓ تم الحفظ' : 'حفظ المفتاح'}
              </button>
            </div>

            {testResult === 'ok' && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <p className="text-emerald-700 text-sm">المفتاح يعمل بشكل صحيح</p>
              </div>
            )}
            {testResult === 'fail' && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-red-700 text-sm">المفتاح غير صالح. تأكد من نسخه بشكل صحيح</p>
              </div>
            )}
          </div>

          <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <p className="text-emerald-700 text-xs font-medium mb-1">✓ OpenRouter مفعّل</p>
            <p className="text-emerald-600 text-xs">
              التطبيق يستخدم OpenRouter تلقائياً — المفتاح مضبوط على الخادم ولا حاجة لإدخاله هنا.
            </p>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">إدارة البيانات</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">البيانات المحمّلة</p>
                <p className="text-gray-400 text-xs">{transactions.length.toLocaleString('ar-EG')} سجل محمّل</p>
              </div>
              <button onClick={() => {
                if (confirm('هل أنت متأكد من حذف كل البيانات؟')) clear()
              }} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
                حذف الكل
              </button>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">معلومات التطبيق</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>الإصدار: 1.0.0</p>
            <p>البيانات محفوظة محلياً في متصفحك (localStorage)</p>
            <p>لا يتم إرسال بياناتك لأي خادم خارجي (إلا عند استخدام AI)</p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
