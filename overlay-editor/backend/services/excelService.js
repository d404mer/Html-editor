import * as XLSX from 'xlsx'
import fs from 'node:fs'
import { excelDebug } from '../utils/excelDebug.js'

function sleepSync(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    // busy wait — Excel on Windows may briefly lock the file while saving
  }
}

/**
 * @param {string} filePath
 * @param {number} [retries]
 */
export function readWorkbook(filePath, retries = 5) {
  let lastErr
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const buffer = fs.readFileSync(filePath)
      excelDebug('readWorkbook ok', { filePath, attempt, bytes: buffer.length })
      return XLSX.read(buffer, { type: 'buffer' })
    } catch (err) {
      lastErr = err
      const code = /** @type {NodeJS.ErrnoException} */ (err).code
      excelDebug('readWorkbook retry', { filePath, attempt, code, message: err.message })
      if (attempt < retries - 1 && (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES')) {
        sleepSync(150 * (attempt + 1))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/**
 * @param {import('xlsx').WorkBook} wb
 * @param {string} sheetName
 * @param {string} cellRef e.g. "B2"
 */
export function getCellValue(wb, sheetName, cellRef) {
  const sheet = wb.Sheets[sheetName]
  if (!sheet || !cellRef) return ''
  const ref = cellRef.toUpperCase().replace(/\s/g, '')
  const cell = sheet[ref]
  if (!cell) return ''
  if (cell.w != null) return String(cell.w)
  if (cell.v == null) return ''
  return String(cell.v)
}

/**
 * @param {import('xlsx').WorkBook} wb
 * @param {string} sheetName
 */
export function getSheetSchema(wb, sheetName) {
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return { headers: [], rowCount: 0, sampleRows: [] }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const headers = (rows[0] ?? []).map((h) => String(h).trim()).filter(Boolean)
  const sampleRows = rows.slice(1, 6).map((row) =>
    headers.map((_, i) => String(row[i] ?? '')),
  )

  return {
    headers,
    rowCount: Math.max(0, rows.length - 1),
    sampleRows,
  }
}

/**
 * @param {import('xlsx').WorkBook} wb
 * @param {string} sheetName
 * @param {string} columnHeader
 * @param {number} row 1-based row in sheet (row 1 = header)
 */
export function getColumnValue(wb, sheetName, columnHeader, row) {
  const sheet = wb.Sheets[sheetName]
  if (!sheet || !columnHeader) return ''

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (rows.length === 0) return ''

  const headers = (rows[0] ?? []).map((h) => String(h).trim())
  const colIndex = headers.findIndex(
    (h) => h.toLowerCase() === columnHeader.trim().toLowerCase(),
  )
  if (colIndex === -1) return ''

  const rowIndex = Math.max(1, row) - 1
  const rowData = rows[rowIndex]
  if (!rowData) return ''
  return String(rowData[colIndex] ?? '')
}

/**
 * @param {import('xlsx').WorkBook} wb
 * @param {{ mode: string, sheet: string, cell?: string, column?: string, row?: number, fallback?: string }} binding
 */
export function resolveBinding(wb, binding) {
  if (!wb || !binding?.sheet) return binding?.fallback ?? ''

  try {
    if (binding.mode === 'cell') {
      const value = getCellValue(wb, binding.sheet, binding.cell ?? 'A1')
      return value || binding.fallback || ''
    }
    if (binding.mode === 'column') {
      const value = getColumnValue(
        wb,
        binding.sheet,
        binding.column ?? '',
        binding.row ?? 2,
      )
      return value || binding.fallback || ''
    }
  } catch {
    return binding?.fallback ?? ''
  }

  return binding?.fallback ?? ''
}

/**
 * @param {string} filePath
 */
export function getWorkbookSchema(filePath) {
  const wb = readWorkbook(filePath)
  const sheets = wb.SheetNames.map((name) => ({
    name,
    ...getSheetSchema(wb, name),
  }))
  return { sheets }
}

/**
 * @param {string} filePath
 * @param {{ mode: string, sheet: string, cell?: string, column?: string, row?: number, fallback?: string }} binding
 */
export function resolveBindingFromFile(filePath, binding) {
  const wb = readWorkbook(filePath)
  return resolveBinding(wb, binding)
}
