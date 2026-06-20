import * as XLSX from 'xlsx'
import { Transaction } from './types'

function makeId(t: Omit<Transaction, 'id'>): string {
  const d = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date)
  return `${d}|${t.account}|${t.subAccount}|${t.analytical}|${t.description}|${t.amount}`
}

function parseExcelDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d)
  }
  if (typeof val === 'string') {
    // Handle DD/M/YYYY and DD/MM/YYYY formats (common in Arabic Excel files)
    const dmyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]))
    const iso = new Date(val)
    if (!isNaN(iso.getTime())) return iso
  }
  return null
}

export interface ParseResult {
  transactions: Transaction[]
  errors: string[]
  totalRows: number
  skippedRows: number
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // raw:true keeps dates as Excel serial numbers so parseExcelDate can convert them
        // accurately — raw:false re-formats them as locale strings (e.g. "18/5/2024")
        // which new Date() cannot parse
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

        const transactions: Transaction[] = []
        const errors: string[] = []
        let totalRows = 0
        let skippedRows = 0

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[]
          if (!row || row.every(c => c === null || c === undefined || c === '')) continue

          totalRows++
          const rawDate = parseExcelDate(row[0])
          if (!rawDate) {
            errors.push(`صف ${i + 1}: تاريخ غير صالح "${row[0]}"`)
            skippedRows++
            continue
          }

          const rawAmount = row[6]
          const amount = typeof rawAmount === 'number'
            ? rawAmount
            : parseFloat(String(rawAmount ?? '0').replace(/,/g, ''))
          if (isNaN(amount)) {
            errors.push(`صف ${i + 1}: مبلغ غير صالح "${rawAmount}"`)
            skippedRows++
            continue
          }

          const t: Omit<Transaction, 'id'> = {
            date: rawDate,
            account: String(row[1] ?? '').trim(),
            subAccount: String(row[2] ?? '').trim(),
            analytical: String(row[3] ?? '').trim(),
            costCenter: String(row[4] ?? '').trim(),
            description: String(row[5] ?? '').trim(),
            amount,
          }

          transactions.push({ ...t, id: makeId(t) })
        }

        resolve({ transactions, errors, totalRows, skippedRows })
      } catch (err) {
        resolve({ transactions: [], errors: [String(err)], totalRows: 0, skippedRows: 0 })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): { merged: Transaction[]; newCount: number; dupCount: number } {
  const existingIds = new Set(existing.map(t => t.id))
  const newOnes = incoming.filter(t => !existingIds.has(t.id))
  return {
    merged: [...existing, ...newOnes],
    newCount: newOnes.length,
    dupCount: incoming.length - newOnes.length,
  }
}
