import ExcelJS from 'exceljs'
import { diffMinutes, formatDateEs, formatShortTime, todayLocalISO } from './dateUtils'
import { FLOOR_LABEL } from './rooms'
import type { ReservationWithDetails } from './types'

const BRAND = 'FF0F766E' // teal-700
const BRAND_LIGHT = 'FFCCFBF1' // teal-100
const INK = 'FF0F172A' // slate-900
const MUTED = 'FF64748B' // slate-500
const BAND = 'FFF8FAFC' // slate-50
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
}

const ROOM_TYPE_LABEL: Record<string, string> = { normal: 'Normal', suite: 'Suite' }

function addTitleBlock(sheet: ExcelJS.Worksheet, title: string, periodLabel: string, range: string, columnCount: number) {
  sheet.mergeCells(1, 1, 1, columnCount)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  sheet.getRow(1).height = 28

  sheet.mergeCells(2, 1, 2, columnCount)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = `${periodLabel} · ${range} · Generado el ${formatDateEs(todayLocalISO())}`
  subtitleCell.font = { italic: true, size: 9, color: { argb: MUTED } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  sheet.getRow(2).height = 16

  sheet.addRow([])
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.alignment = { vertical: 'middle' }
    cell.border = BORDER
  })
  row.height = 20
}

function styleDataRows(sheet: ExcelJS.Worksheet, firstRow: number, lastRow: number, numericCols: number[]) {
  for (let r = firstRow; r <= lastRow; r++) {
    const row = sheet.getRow(r)
    const banded = (r - firstRow) % 2 === 1
    row.eachCell((cell, col) => {
      cell.border = BORDER
      cell.font = { size: 10, color: { argb: INK } }
      if (banded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } }
      if (numericCols.includes(col)) cell.alignment = { horizontal: 'right' }
    })
  }
}

function autoFitColumns(sheet: ExcelJS.Worksheet, skipRows: number) {
  sheet.columns.forEach((col) => {
    let max = 10
    col.eachCell?.({ includeEmpty: false }, (cell, rowNum) => {
      if (rowNum <= skipRows) return
      const len = String(cell.value ?? '').length
      if (len > max) max = len
    })
    col.width = Math.min(max + 2, 40)
  })
}

export async function exportReservationsExcel(reservations: ReservationWithDetails[], rangeSlug: string, periodLabel: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Reserva de lavadora'
  workbook.created = new Date()
  workbook.title = 'Reporte de uso de lavadora'

  const rangeLabel = rangeSlug.replace('_a_', ' → ')

  const sorted = [...reservations].sort((a, b) => {
    const fa = a.profiles?.floor ?? ''
    const fb = b.profiles?.floor ?? ''
    if (fa !== fb) return fa.localeCompare(fb)
    const ra = a.profiles?.room_number ?? ''
    const rb = b.profiles?.room_number ?? ''
    if (ra !== rb) return ra.localeCompare(rb, undefined, { numeric: true })
    return a.starts_at.localeCompare(b.starts_at)
  })

  const totalMinutes = sorted.reduce((sum, r) => sum + diffMinutes(r.starts_at, r.ends_at), 0)

  const byFloor = new Map<string, { count: number; minutes: number }>()
  const byRoom = new Map<string, { piso: string; habitacion: string; inquilino: string; count: number; minutes: number }>()
  for (const r of sorted) {
    const floor = r.profiles ? FLOOR_LABEL[r.profiles.floor] : 'Sin dato'
    const fEntry = byFloor.get(floor) ?? { count: 0, minutes: 0 }
    fEntry.count += 1
    fEntry.minutes += diffMinutes(r.starts_at, r.ends_at)
    byFloor.set(floor, fEntry)

    if (!r.profiles) continue
    const key = `${r.profiles.floor}|${r.profiles.room_number}`
    const rEntry = byRoom.get(key) ?? {
      piso: FLOOR_LABEL[r.profiles.floor],
      habitacion: r.profiles.room_number,
      inquilino: `${r.profiles.first_name} ${r.profiles.last_name}`,
      count: 0,
      minutes: 0,
    }
    rEntry.count += 1
    rEntry.minutes += diffMinutes(r.starts_at, r.ends_at)
    byRoom.set(key, rEntry)
  }
  const floorRanking = [...byFloor.entries()].sort((a, b) => b[1].minutes - a[1].minutes)
  const roomRanking = [...byRoom.values()].sort((a, b) => b.minutes - a.minutes)

  // ===================== Hoja 1: Resumen ejecutivo =====================
  const summary = workbook.addWorksheet('Resumen')
  addTitleBlock(summary, 'Reporte de uso — Reserva de lavadora', periodLabel, rangeLabel, 2)

  const kpis: Array<[string, string | number]> = [
    ['Reservas totales', sorted.length],
    ['Horas totales de uso', Math.round((totalMinutes / 60) * 10) / 10],
    ['Inquilinos con reservas', byRoom.size],
    ['Piso con más uso', floorRanking[0]?.[0] ?? '—'],
    ['Habitación con más uso', roomRanking[0] ? `${roomRanking[0].piso} · Hab. ${roomRanking[0].habitacion}` : '—'],
  ]
  for (const [label, value] of kpis) {
    const row = summary.addRow([label, value])
    row.getCell(1).font = { bold: true, size: 10, color: { argb: INK } }
    row.getCell(2).font = { size: 12, bold: true, color: { argb: BRAND } }
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } }
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } }
    row.getCell(1).border = BORDER
    row.getCell(2).border = BORDER
    row.height = 20
  }
  summary.getColumn(1).width = 26
  summary.getColumn(2).width = 28
  summary.addRow([])
  const note = summary.addRow(['Ver hojas "Reservas", "Resumen por piso" y "Resumen por habitación" para el detalle completo.'])
  note.getCell(1).font = { italic: true, size: 9, color: { argb: MUTED } }
  summary.mergeCells(summary.rowCount, 1, summary.rowCount, 2)

  // ===================== Hoja 2: detalle de reservas =====================
  const detail = workbook.addWorksheet('Reservas')
  addTitleBlock(detail, 'Detalle de reservas', periodLabel, rangeLabel, 9)
  const detailHeaderRowNum = detail.rowCount + 1
  detail.getRow(detailHeaderRowNum).values = [
    'Fecha',
    'Hora inicio',
    'Hora fin',
    'Duración (min)',
    'Piso',
    'Habitación',
    'Tipo',
    'Inquilino',
    'Teléfono',
  ]
  detail.columns = [
    { key: 'fecha', width: 12 },
    { key: 'inicio', width: 12 },
    { key: 'fin', width: 12 },
    { key: 'duracion', width: 14 },
    { key: 'piso', width: 12 },
    { key: 'habitacion', width: 12 },
    { key: 'tipo', width: 10 },
    { key: 'inquilino', width: 24 },
    { key: 'telefono', width: 16 },
  ]
  for (const r of sorted) {
    detail.addRow({
      fecha: formatDateEs(r.starts_at.slice(0, 10)),
      inicio: formatShortTime(r.starts_at),
      fin: formatShortTime(r.ends_at),
      duracion: Math.round(diffMinutes(r.starts_at, r.ends_at)),
      piso: r.profiles ? FLOOR_LABEL[r.profiles.floor] : '—',
      habitacion: r.profiles?.room_number ?? '—',
      tipo: r.profiles ? ROOM_TYPE_LABEL[r.profiles.room_type] : '—',
      inquilino: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : '—',
      telefono: r.profiles?.phone ?? '—',
    })
  }
  styleHeaderRow(detail.getRow(detailHeaderRowNum))
  styleDataRows(detail, detailHeaderRowNum + 1, detail.rowCount, [4])
  detail.views = [{ state: 'frozen', ySplit: detailHeaderRowNum }]
  detail.autoFilter = { from: { row: detailHeaderRowNum, column: 1 }, to: { row: detailHeaderRowNum, column: 9 } }

  // ===================== Hoja 3: resumen por piso =====================
  const floorSheet = workbook.addWorksheet('Resumen por piso')
  addTitleBlock(floorSheet, 'Resumen por piso', periodLabel, rangeLabel, 3)
  const floorHeaderRowNum = floorSheet.rowCount + 1
  floorSheet.getRow(floorHeaderRowNum).values = ['Piso', 'Reservas', 'Horas totales']
  floorSheet.columns = [{ key: 'piso', width: 18 }, { key: 'reservas', width: 12 }, { key: 'horas', width: 14 }]
  for (const [piso, { count, minutes }] of floorRanking) {
    floorSheet.addRow({ piso, reservas: count, horas: Math.round((minutes / 60) * 10) / 10 })
  }
  styleHeaderRow(floorSheet.getRow(floorHeaderRowNum))
  styleDataRows(floorSheet, floorHeaderRowNum + 1, floorSheet.rowCount, [2, 3])

  // ===================== Hoja 4: resumen por habitación =====================
  const roomSheet = workbook.addWorksheet('Resumen por habitación')
  addTitleBlock(roomSheet, 'Resumen por habitación', periodLabel, rangeLabel, 5)
  const roomHeaderRowNum = roomSheet.rowCount + 1
  roomSheet.getRow(roomHeaderRowNum).values = ['Piso', 'Habitación', 'Inquilino', 'Reservas', 'Horas totales']
  roomSheet.columns = [
    { key: 'piso', width: 18 },
    { key: 'habitacion', width: 12 },
    { key: 'inquilino', width: 24 },
    { key: 'reservas', width: 12 },
    { key: 'horas', width: 14 },
  ]
  for (const { piso, habitacion, inquilino, count, minutes } of roomRanking) {
    roomSheet.addRow({ piso, habitacion, inquilino, reservas: count, horas: Math.round((minutes / 60) * 10) / 10 })
  }
  styleHeaderRow(roomSheet.getRow(roomHeaderRowNum))
  styleDataRows(roomSheet, roomHeaderRowNum + 1, roomSheet.rowCount, [4, 5])

  autoFitColumns(detail, detailHeaderRowNum)
  autoFitColumns(floorSheet, floorHeaderRowNum)
  autoFitColumns(roomSheet, roomHeaderRowNum)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reservas-lavadora_${rangeSlug}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
