import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AccountType } from '@/lib/types'

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
  }

  // Each upload is a full refreshed export of the ledger (not incremental daily rows), so every
  // upload fully replaces prior data — wrapped in one transaction so a failed insert can't leave
  // the DB with the old data already deleted and nothing to replace it.
  const { accountCount, entryCount } = await prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany()
    await tx.account.deleteMany()

    if (body.accounts.length > 0) {
      await tx.account.createMany({
        data: body.accounts.map(a => ({
          code: a.code, name: a.name, type: a.type, parentCode: a.parentCode, level: a.level,
        })),
      })
    }

    if (body.entries.length > 0) {
      await tx.journalLine.createMany({
        data: body.entries.map((e, i) => ({
          id: `${e.entryNumber}-${e.accountCode}-${i}`,
          entryNumber: e.entryNumber,
          entryDate: new Date(e.entryDate),
          postingDate: new Date(e.postingDate),
          refNumber: e.refNumber,
          docType: e.docType,
          description: e.description,
          accountCode: e.accountCode,
          accountName: e.accountName,
          accountType: e.accountType,
          costCenter: e.costCenter,
          debit: e.debit,
          credit: e.credit,
          approvalStatus: e.approvalStatus,
        })),
      })
    }

    return { accountCount: body.accounts.length, entryCount: body.entries.length }
  })

  return NextResponse.json({ accountCount, entryCount })
}

export async function DELETE() {
  await prisma.$transaction([
    prisma.journalLine.deleteMany(),
    prisma.account.deleteMany(),
  ])
  return NextResponse.json({ success: true })
}
