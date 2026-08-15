import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SheetName, BalanceSheetSection } from '@/lib/types'

export async function GET() {
  const [metricRows, balanceRows] = await Promise.all([
    prisma.monthlyMetric.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
    prisma.balanceSheetLine.findMany({ orderBy: { id: 'asc' } }),
  ])

  const metrics = metricRows.map(r => ({
    id: r.id, sheet: r.sheet as SheetName, category: r.category, year: r.year, month: r.month, amount: r.amount,
  }))
  const balanceSheet = balanceRows.map(r => ({
    id: r.id, label: r.label, code: r.code, section: r.section as BalanceSheetSection,
    isTotal: r.isTotal, amount: r.amount, asOfDate: r.asOfDate,
  }))

  return NextResponse.json({ metrics, balanceSheet })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    year: number
    metrics: Array<{ sheet: SheetName; category: string; month: number; amount: number }>
    balanceSheet: Array<{ label: string; code: string | null; section: BalanceSheetSection; isTotal: boolean; amount: number }>
    asOfDate: string | null
  }

  const asOfDate = body.asOfDate ? new Date(body.asOfDate) : new Date()

  // Each upload is a full refreshed snapshot of the workbook (not incremental daily rows),
  // so every upload fully replaces prior data — wrapped in one transaction so a failed insert
  // can't leave the DB with the old data already deleted and nothing to replace it.
  const { metricCount, balanceCount } = await prisma.$transaction(async (tx) => {
    await tx.monthlyMetric.deleteMany()
    await tx.balanceSheetLine.deleteMany()

    if (body.metrics.length > 0) {
      await tx.monthlyMetric.createMany({
        data: body.metrics.map(m => ({
          id: `${m.sheet}|${m.category}|${body.year}-${m.month}`,
          sheet: m.sheet,
          category: m.category,
          year: body.year,
          month: m.month,
          amount: m.amount,
        })),
      })
    }

    if (body.balanceSheet.length > 0) {
      await tx.balanceSheetLine.createMany({
        data: body.balanceSheet.map((b, i) => ({
          id: `${b.section}::${b.label}::${i}`,
          label: b.label,
          code: b.code,
          section: b.section,
          isTotal: b.isTotal,
          amount: b.amount,
          asOfDate,
        })),
      })
    }

    return { metricCount: body.metrics.length, balanceCount: body.balanceSheet.length }
  })

  return NextResponse.json({ metricCount, balanceCount })
}

export async function DELETE() {
  await prisma.$transaction([
    prisma.monthlyMetric.deleteMany(),
    prisma.balanceSheetLine.deleteMany(),
  ])
  return NextResponse.json({ success: true })
}
