import * as XLSX from 'xlsx'

export type ExcelSheet = {
  name: string
  data: (string | number | null)[][]
}

export async function exportToPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId)
  if (!element) return

  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * contentWidth) / canvas.width

  let y = margin
  let remaining = imgHeight

  while (remaining > 0) {
    const sliceHeight = Math.min(remaining, pageHeight - margin * 2)
    const sourceY = (imgHeight - remaining) * (canvas.height / imgHeight)
    const sourceH = sliceHeight * (canvas.height / imgHeight)

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sourceH
    const ctx = sliceCanvas.getContext('2d')!
    ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH)

    if (y > margin) pdf.addPage()
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, sliceHeight)

    remaining -= sliceHeight
    y = margin
  }

  pdf.save(`${filename}.pdf`)
}

export function exportToExcel(sheets: ExcelSheet[], filename: string) {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data)
    // RTL direction
    ws['!dir'] = 'rtl'
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
