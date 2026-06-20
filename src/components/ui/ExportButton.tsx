'use client'
import { useState, useRef, useEffect } from 'react'
import { Download, FileText, Table, Loader2 } from 'lucide-react'
import { exportToPdf, exportToExcel, ExcelSheet } from '@/lib/export-utils'

interface Props {
  exportId: string
  filename: string
  excelSheets?: ExcelSheet[]
}

export default function ExportButton({ exportId, filename, excelSheets }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handlePdf() {
    setOpen(false)
    setLoading('pdf')
    try {
      await exportToPdf(exportId, filename)
    } finally {
      setLoading(null)
    }
  }

  function handleExcel() {
    setOpen(false)
    if (!excelSheets) return
    setLoading('excel')
    try {
      exportToExcel(excelSheets, filename)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading !== null}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        تنزيل
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-100 shadow-lg z-50 overflow-hidden">
          <button
            onClick={handlePdf}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4 text-red-500" />
            تنزيل PDF
          </button>
          {excelSheets && (
            <button
              onClick={handleExcel}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-50"
            >
              <Table className="w-4 h-4 text-emerald-600" />
              تنزيل Excel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
