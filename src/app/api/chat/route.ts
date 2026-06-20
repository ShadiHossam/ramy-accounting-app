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
    const { messages, context, apiKey } = await req.json()

    let client: Anthropic
    if (apiKey) {
      client = new Anthropic({ apiKey })
    } else {
      const authToken = getCliAuthToken()
      if (!authToken) return NextResponse.json({ error: 'مفتاح API مطلوب أو قم بتسجيل الدخول عبر Claude CLI' }, { status: 400 })
      client = new Anthropic({ authToken })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `أنت مستشار مالي ذكي ومتخصص. لديك إمكانية الوصول الكامل للبيانات المالية التالية:

${context}

قواعد الإجابة:
- أجب دائماً بالعربية
- كن دقيقاً في الأرقام وأذكر المصدر
- استخدم تنسيق الأرقام العربي (فواصل للآلاف)
- إذا سُئلت عن شيء غير موجود في البيانات، اذكر ذلك بوضوح
- يمكنك المقارنة والتحليل والتوقع`,
      messages: messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ غير معروف'
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: msg }, { status: status >= 400 && status < 600 ? status : 500 })
  }
}
