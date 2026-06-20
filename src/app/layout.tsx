import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'

const cairo = Cairo({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'نظام التحليل المالي',
  description: 'نظام متكامل لتحليل الحسابات والتقارير المالية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className={`${cairo.className} h-full bg-gray-50`}>
        {children}
      </body>
    </html>
  )
}
