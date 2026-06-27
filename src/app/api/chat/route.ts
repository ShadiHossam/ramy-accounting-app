import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'meta-llama/llama-3.3-70b-instruct:free'

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'مفتاح OpenRouter API غير مضبوط على الخادم' }, { status: 500 })

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: `أنت مستشار مالي ذكي ومتخصص. لديك إمكانية الوصول الكامل للبيانات المالية التالية:

${context}

قواعد الإجابة:
- أجب دائماً بالعربية
- كن دقيقاً في الأرقام وأذكر المصدر
- استخدم تنسيق الأرقام العربي (فواصل للآلاف)
- إذا سُئلت عن شيء غير موجود في البيانات، اذكر ذلك بوضوح
- يمكنك المقارنة والتحليل والتوقع`,
          },
          ...messages,
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      let msg = 'خطأ من خادم OpenRouter'
      if (res.status === 429) msg = 'تجاوزت حد الاستخدام المسموح به. حاول مرة أخرى لاحقاً.'
      else if (res.status === 401) msg = 'مفتاح OpenRouter API غير صالح.'
      console.error('OpenRouter error:', res.status, body)
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    const data = await res.json()
    const reply: string = data.choices?.[0]?.message?.content ?? ''
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ غير معروف'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
