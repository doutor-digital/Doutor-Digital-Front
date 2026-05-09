/**
 * Tiny CSV parser that handles quoted fields, embedded commas, and embedded quotes ("").
 * Returns an array of rows; the first row is the header. Auto-detects comma or semicolon delimiter.
 * Good enough for spreadsheet exports — for advanced cases we'd reach for Papa Parse later.
 */
export function parseCSV(input: string): string[][] {
  const text = input.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.trim()) return []

  // Detect delimiter from the first non-quoted line
  const sampleLine = text.slice(0, 2000)
  const commaCount = (sampleLine.match(/,/g) || []).length
  const semiCount = (sampleLine.match(/;/g) || []).length
  const delimiter = semiCount > commaCount ? ';' : ','

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
      continue
    }
    if (c === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += c
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop trailing empty rows
  while (rows.length && rows[rows.length - 1].every((v) => v.trim() === '')) {
    rows.pop()
  }

  return rows
}

export function csvToObjects(rows: string[][]): { headers: string[]; records: Record<string, string>[] } {
  if (rows.length === 0) return { headers: [], records: [] }
  const headers = rows[0].map((h) => h.trim())
  const records = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim()
    })
    return obj
  })
  return { headers, records }
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (cell: string) => {
    if (/[",\n;]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
    return cell
  }
  const lines = [headers.map(escape).join(',')]
  for (const r of rows) lines.push(r.map(escape).join(','))
  return lines.join('\n')
}

export function downloadFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
