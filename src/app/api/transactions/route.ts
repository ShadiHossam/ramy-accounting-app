import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const rows = await prisma.transaction.findMany({ orderBy: { date: 'asc' } })
  const transactions = rows.map(r => ({
    id: r.id,
    date: r.date,
    account: r.account,
    subAccount: r.subAccount,
    analytical: r.analytical,
    costCenter: r.costCenter,
    description: r.description,
    amount: r.amount,
  }))
  return NextResponse.json({ transactions })
}

export async function POST(req: NextRequest) {
  const { transactions, mode } = await req.json() as {
    transactions: Array<{
      id: string
      date: string
      account: string
      subAccount: string
      analytical: string
      costCenter: string
      description: string
      amount: number
    }>
    mode: 'merge' | 'replace'
  }

  if (mode === 'replace') {
    await prisma.transaction.deleteMany()
  }

  const existingIds = new Set(
    (await prisma.transaction.findMany({ select: { id: true } })).map(r => r.id)
  )

  const newOnes = transactions.filter(t => !existingIds.has(t.id))
  const dupCount = transactions.length - newOnes.length

  if (newOnes.length > 0) {
    await prisma.transaction.createMany({
      data: newOnes.map(t => ({
        id: t.id,
        date: new Date(t.date),
        account: t.account,
        subAccount: t.subAccount,
        analytical: t.analytical,
        costCenter: t.costCenter,
        description: t.description,
        amount: t.amount,
      })),
      skipDuplicates: true,
    })
  }

  const total = await prisma.transaction.count()
  return NextResponse.json({ newCount: newOnes.length, dupCount, total })
}

export async function DELETE() {
  await prisma.transaction.deleteMany()
  return NextResponse.json({ success: true })
}
