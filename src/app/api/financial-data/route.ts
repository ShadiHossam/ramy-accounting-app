import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AccountType } from '@/lib/types'
import { replaceLedger } from '@/lib/ledger-store'

export async function GET() {
  const [accountRows, entryRows] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: 'asc' } }),
    prisma.journalLine.findMany({ orderBy: { entryDate: 'asc' } }),
  ])

  const accounts = accountRows.map(a => ({
    code: a.code, name: a.name, type: a.type as AccountType, parentCode: a.parentCode, level: a.level,
  }))
  const entries = entryRows.map(e => ({
    id: e.id, entryNumber: e.entryNumber, entryDate: e.entryDate, postingDate: e.postingDate,
    refNumber: e.refNumber, docType: e.docType, description: e.description,
    accountCode: e.accountCode, accountName: e.accountName, accountType: e.accountType as AccountType,
    costCenter: e.costCenter, debit: e.debit, credit: e.credit, approvalStatus: e.approvalStatus,
  }))

  return NextResponse.json({ accounts, entries })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    accounts: Array<{ code: number; name: string; type: AccountType; parentCode: number | null; level: number }>
    entries: Array<{
      entryNumber: number; entryDate: string; postingDate: string; refNumber: string; docType: string
      description: string; accountCode: number; accountName: string; accountType: AccountType
      costCenter: string; debit: number; credit: number; approvalStatus: string
    }>
    replaceOpeningBalance: boolean
  }

  const { accountCount, entryCount } = await replaceLedger(body.accounts, body.entries, body.replaceOpeningBalance)

  return NextResponse.json({ accountCount, entryCount })
}

export async function DELETE() {
  await prisma.$transaction([
    prisma.journalLine.deleteMany(),
    prisma.account.deleteMany(),
  ])
  return NextResponse.json({ success: true })
}
