'use client'
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react'
import { useFinancialStore } from '@/store/financial-store'
import { buildFinancialContext } from '@/lib/financial-engine'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'إيه أكتر شهر ربحت فيه؟',
  'إيه أعلى مصدر دخل؟',
  'قارنلي المصروفات بالإيرادات',
  'إيه نسبة الربح الإجمالي؟',
  'أنهي بنود الصرف الأعلى؟',
]

export default function AIChatButton() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { transactions, period, apiKey } = useFinancialStore()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    const userMsg: Message = { role: 'user', content: msg }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const context = buildFinancialContext(transactions, period)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context,
          apiKey: apiKey || undefined,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? data.error ?? 'خطأ في الاستجابة' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'حدث خطأ في الاتصال.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-50"
        title="المساعد المالي الذكي"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 left-6 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <div>
            <p className="font-semibold text-sm">المساعد المالي الذكي</p>
            <p className="text-indigo-200 text-xs">اسألني أي شيء عن حساباتك</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded-lg p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Bot className="w-10 h-10 text-indigo-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm mb-4">أهلاً! أنا مساعدك المالي الذكي</p>
            <div className="space-y-2">
              <p className="text-gray-400 text-xs mb-2">اقتراحات:</p>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="w-full text-right text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg px-3 py-2 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', m.role === 'user' ? 'bg-indigo-100' : 'bg-purple-100')}>
              {m.role === 'user' ? <User className="w-3.5 h-3.5 text-indigo-600" /> : <Bot className="w-3.5 h-3.5 text-purple-600" />}
            </div>
            <div className={cn('max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed', m.role === 'user' ? 'bg-indigo-600 text-white rounded-bl-none' : 'bg-gray-100 text-gray-800 rounded-br-none')}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-br-none px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="اسألني أي سؤال..."
            disabled={loading}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 disabled:bg-gray-50"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="bg-indigo-600 text-white rounded-xl p-2 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
