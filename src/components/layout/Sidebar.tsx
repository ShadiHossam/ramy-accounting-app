'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, TrendingDown, FileText, Scale,
  ArrowLeftRight, BarChart3, Users, Target, PieChart,
  Upload, Sparkles, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/upload', label: 'رفع الملف', icon: Upload },
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/income-statement', label: 'قائمة الدخل', icon: FileText },
  { href: '/revenue', label: 'تحليل الإيرادات', icon: TrendingUp },
  { href: '/expenses', label: 'تحليل المصروفات', icon: TrendingDown },
  { href: '/balance-sheet', label: 'الميزانية العمومية', icon: Scale },
  { href: '/cash-flow', label: 'التدفق النقدي', icon: ArrowLeftRight },
  { href: '/agents', label: 'تحليل المندوبين', icon: Users },
  { href: '/cost-centers', label: 'مراكز التكلفة', icon: Target },
  { href: '/analysis', label: 'التحليل المالي', icon: BarChart3 },
  { href: '/budgeting', label: 'الميزانية التقديرية', icon: PieChart },
  { href: '/ai-insights', label: 'تقرير AI', icon: Sparkles },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'w-64 bg-slate-900 text-white flex flex-col min-h-screen fixed right-0 top-0 z-50 transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Usine Accounting AI</h1>
              <p className="text-slate-400 text-xs">المحاسب الذكي</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs text-center">v1.0.0 · Usine Accounting AI</p>
        </div>
      </aside>
    </>
  )
}
