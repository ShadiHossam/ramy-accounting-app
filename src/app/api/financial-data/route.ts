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

const OPENING_BALANCE_DOC_TYPE = 'رصيد افتتاحي'

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

  // Each journal upload is a full refreshed export of the ledger (not incremental daily rows), so
  // every upload fully replaces prior journal data — wrapped in one transaction so a failed insert
  // can't leave the DB with the old data already deleted and nothing to replace it.
  //
  // The opening balance is a separate, rarely-changed file: the user uploads it once, then keeps
  // re-uploading refreshed journal-only exports without re-attaching it. If we always wiped
  // opening-balance rows too, they'd silently disappear on the next journal-only upload instead of
  // staying put. So we only touch opening-balance rows when this request explicitly carries a new
  // one (replaceOpeningBalance) — in that case the old ones are dropped and the new ones take over,
  // never both at once.
  const { accountCount, entryCount } = await prisma.$transaction(async (tx) => {
    let preservedOpeningLines: Array<{
      id: string; entryNumber: number; entryDate: Date; postingDate: Date; refNumber: string; docType: string
      description: string; accountCode: number; accountName: string; accountType: string
      costCenter: string; debit: number; credit: number; approvalStatus: string
    }> = []
    let preservedOpeningAccounts: Array<{ code: number; name: string; type: string; parentCode: number | null; level: number }> = []

    if (!body.replaceOpeningBalance) {
      preservedOpeningLines = await tx.journalLine.findMany({ where: { docType: OPENING_BALANCE_DOC_TYPE } })

      const newAccountCodes = new Set(body.accounts.map(a => a.code))
      const openingOnlyCodes = [...new Set(preservedOpeningLines.map(l => l.accountCode))]
        .filter(code => !newAccountCodes.has(code))
      if (openingOnlyCodes.length > 0) {
        preservedOpeningAccounts = await tx.account.findMany({ where: { code: { in: openingOnlyCodes } } })
      }
    }

    await tx.journalLine.deleteMany()
    await tx.account.deleteMany()

    const accountsToInsert = [
      ...body.accounts.map(a => ({ code: a.code, name: a.name, type: a.type as string, parentCode: a.parentCode, level: a.level })),
      ...preservedOpeningAccounts,
    ]
    if (accountsToInsert.length > 0) {
      await tx.account.createMany({ data: accountsToInsert })
    }

    const newEntryRows = body.entries.map((e, i) => ({
      id: `${e.entryNumber}-${e.accountCode}-${i}`,
      entryNumber: e.entryNumber,
      entryDate: new Date(e.entryDate),
      postingDate: new Date(e.postingDate),
      refNumber: e.refNumber,
      docType: e.docType,
      description: e.description,
      accountCode: e.accountCode,
      accountName: e.accountName,
      accountType: e.accountType as string,
      costCenter: e.costCenter,
      debit: e.debit,
      credit: e.credit,
      approvalStatus: e.approvalStatus,
    }))
    const entriesToInsert = [...newEntryRows, ...preservedOpeningLines]

    if (entriesToInsert.length > 0) {
      await tx.journalLine.createMany({ data: entriesToInsert })
    }

    return { accountCount: accountsToInsert.length, entryCount: entriesToInsert.length }
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
