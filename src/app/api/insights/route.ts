import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'

function getCliAuthToken(): string | null {
  try {
    const raw = execSync('security find-generic-password -l "Claude Code-credentials" -w', { encoding: 'utf8' }).trim()
    const creds = JSON.parse(raw)
    return creds?.claudeAiOauth?.accessToken ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { context, apiKey } = await req.json()

    let client: Anthropic
    if (apiKey) {
      client = new Anthropic({ apiKey })
    } else {
      const authToken = getCliAuthToken()
      if (!authToken) return NextResponse.json({ error: 'مفتاح API مطلوب أو قم بتسجيل الدخول عبر Claude CLI' }, { status: 400 })
      client = new Anthropic({ authToken })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `أنت مستشار مالي خبير. بناءً على البيانات المالية المقدمة، قدم تحليلاً دقيقاً.
أجب دائماً بتنسيق JSON بالضبط كما يلي:
{
  "problems": ["مشكلة 1", "مشكلة 2", ...],
  "suggestions": ["مقترح 1", "مقترح 2", ...],
  "opportunities": ["فرصة 1", "فرصة 2", ...]
}
- problems: مشاكل أو تحديات مالية واضحة (3-4 نقاط)
- suggestions: توصيات لتحسين الأداء (3-4 نقاط)
- opportunities: فرص نمو ممكنة (3-4 نقاط)
كن محدداً مع الأرقام عند توفرها. أجب بالعربية.`,
      messages: [{ role: 'user', content: `حلل هذه البيانات المالية وأعطني التقرير:\n${context}` }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'فشل في تحليل الاستجابة' }, { status: 500 })

    const insights = JSON.parse(jsonMatch[0])
    return NextResponse.json({ insights })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ غير معروف'
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: msg }, { status: status >= 400 && status < 600 ? status : 500 })
  }
}
