'use client'
import { useEffect } from 'react'
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

  useEffect(() => {
    if (!dbLoaded) loadFromDB()
  }, [dbLoaded, loadFromDB])

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 mr-64 flex flex-col min-h-screen">
        <Header title={title} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      <AIChatButton />
    </div>
  )
}
