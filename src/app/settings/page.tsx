'use client'
import AppShell from '@/components/layout/AppShell'
import { useFinancialStore } from '@/store/financial-store'
import { Key, Trash2 } from 'lucide-react'

export default function SettingsPage() {
  const { metrics, clear } = useFinancialStore()

  return (
    <AppShell title="الإعدادات">
      <div className="max-w-2xl space-y-6">
        {/* AI status */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <Key className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">المساعد الذكي وتقرير الإنسايتس</h3>
              <p className="text-gray-400 text-xs">لا حاجة لإعداد أي مفتاح — الاتصال يتم تلقائياً من الخادم</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <p className="text-emerald-700 text-xs font-medium mb-1">✓ مفعّل</p>
            <p className="text-emerald-600 text-xs">
              التطبيق يستخدم Groq و OpenRouter تلقائياً — المفتاح مضبوط على الخادم ولا حاجة لإدخاله هنا.
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
                <p className="text-gray-400 text-xs">{metrics.length.toLocaleString('ar-EG')} قيمة محمّلة</p>
              </div>
              <button onClick={async () => {
                if (confirm('هل أنت متأكد من حذف كل البيانات؟')) await clear()
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
            <p>الحركات المالية محفوظة في قاعدة بيانات على الخادم</p>
            <p>الميزانية والإعدادات المحلية محفوظة في متصفحك (localStorage)</p>
            <p>عند استخدام المساعد الذكي، تُرسل بيانات الفترة المعروضة إلى مزوّد الذكاء الاصطناعي لتحليلها</p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
