'use client'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import AIChatButton from './AIChatButton'
import { useFinancialStore } from '@/store/financial-store'

interface Props {
  children: React.ReactNode
  title: string
}

export default function AppShell({ children, title }: Props) {
  const { dbLoaded, loadFromDB } = useFinancialStore()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!dbLoaded) loadFromDB()
  }, [dbLoaded, loadFromDB])

  return (
    <div className="min-h-screen flex">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 lg:mr-64 flex flex-col min-h-screen">
        <Header title={title} onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
      <AIChatButton />
    </div>
  )
}
