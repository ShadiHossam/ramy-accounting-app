import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Tried in order. Groq's free tier is generally faster/more reliable than
// OpenRouter's shared free models, so its best model goes first as the default.
const MODELS = [
  { provider: 'groq', model: 'openai/gpt-oss-120b' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'openrouter', model: 'openrouter/free' },
  { provider: 'openrouter', model: 'openai/gpt-oss-120b:free' },
  { provider: 'openrouter', model: 'google/gemma-4-31b-it:free' },
  { provider: 'groq', model: 'openai/gpt-oss-20b' },
  { provider: 'groq', model: 'llama-3.1-8b-instant' },
  { provider: 'openrouter', model: 'openai/gpt-oss-20b:free' },
  { provider: 'openrouter', model: 'nvidia/nemotron-3-nano-30b-a3b:free' },
] as const

const SYSTEM_PROMPT = `أنت مستشار مالي خبير ومحلل أعمال متمرس. مهمتك تقديم تقرير مالي احترافي شامل لصاحب العمل يساعده على اتخاذ قرارات فورية وصحيحة.

منهجية التحليل:
- اربط كل نقطة بالأرقام والنسب الفعلية من البيانات
- حدد الأسباب الجذرية للمشاكل وليس مجرد وصف الأعراض
- قارن الأشهر والفترات واكشف الأنماط والتحولات المهمة
- اقيّم كل مؤشر مالي: هل هو جيد أم يحتاج تحسين أم في منطقة خطر؟
- قدم توصيات بخطوات تنفيذية محددة وأهداف رقمية وجدول زمني
- قدّر الأثر المالي المحتمل للفرص (إيرادات إضافية أو وفر بالأرقام)

أجب بتنسيق JSON فقط بدون أي نص خارجه:
{
  "period": "اسم الفترة المحللة",
  "summary": "فقرة تنفيذية (3-4 جمل) تلخص الوضع المالي الكلي مع ذكر أبرز الأرقام والحكم الشامل على الأداء ومستوى الخطر",
  "alerts": [
    "تنبيه عاجل يحتاج تدخل فوري — مع الرقم المحدد والتأثير على العمل",
    "..."
  ],
  "kpis": [
    {"name": "اسم المؤشر", "value": "القيمة الرقمية", "status": "good", "comment": "تعليق موجز يوضح ما تعنيه هذه القيمة"},
    {"name": "...", "value": "...", "status": "warning", "comment": "..."},
    {"name": "...", "value": "...", "status": "danger", "comment": "..."}
  ],
  "problems": [
    "وصف المشكلة مع الرقم الدقيق + السبب الجذري + تأثيرها على الأداء المالي",
    "..."
  ],
  "suggestions": [
    "التوصية + خطوات التنفيذ المحددة + الهدف الرقمي + الجدول الزمني المقترح",
    "..."
  ],
  "opportunities": [
    "الفرصة + تقدير الإمكانيات بالأرقام (مثال: يمكن زيادة الإيرادات بـ X%) + خطة الاستغلال",
    "..."
  ]
}

المطلوب: 2-3 تنبيهات (alerts)، 5-6 مؤشرات (kpis)، 4-5 نقاط في كل من problems وsuggestions وopportunities.
قيم status يكون إما: "good" أو "warning" أو "danger" فقط.
أجب بالعربية فقط.`

function callModel(provider: string, model: string, context: string, apiKey: string) {
  const url = provider === 'groq' ? GROQ_URL : OPENROUTER_URL
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `حلل هذه البيانات المالية وأعطني التقرير الكامل:\n${context}` },
      ],
    }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { context } = await req.json()

    const groqKey = process.env.GROQ_API_KEY
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (!groqKey && !openrouterKey) {
      return NextResponse.json({ error: 'مفتاح Groq أو OpenRouter API غير مضبوط على الخادم' }, { status: 500 })
    }

    let lastStatus = 500

    for (const { provider, model } of MODELS) {
      const apiKey = provider === 'groq' ? groqKey : openrouterKey
      if (!apiKey) continue

      const res = await callModel(provider, model, context, apiKey)

      if (res.ok) {
        const data = await res.json()
        const text: string = data.choices?.[0]?.message?.content ?? ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.error(`No JSON in response (${provider}/${model}):`, text.slice(0, 300))
          continue
        }
        try {
          const insights = JSON.parse(jsonMatch[0])
          return NextResponse.json({ insights })
        } catch {
          console.error(`JSON parse error (${provider}/${model}):`, jsonMatch[0].slice(0, 200))
          continue
        }
      }

      lastStatus = res.status
      const lastBody = await res.text()
      console.error(`${provider} error (${model}):`, lastStatus, lastBody)

      if (lastStatus === 401) continue
    }

    let msg = 'خطأ من خادم الذكاء الاصطناعي'
    if (lastStatus === 429) msg = 'جميع النماذج المجانية مشغولة حالياً. حاول مرة أخرى بعد دقيقة.'
    else if (lastStatus === 401) msg = 'مفتاح API غير صالح.'
    return NextResponse.json({ error: msg }, { status: lastStatus })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ غير معروف'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
