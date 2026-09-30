import ExcelJS from 'exceljs'
import { diffMinutes, formatDateEs, formatShortTime } from './dateUtils'
import { FLOOR_LABEL } from './rooms'
import type { ReservationWithDetails } from './types'

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } }

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle' }
  })
  row.height = 20
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length
      if (len > max) max = len
    })
    col.width = Math.min(max + 2, 40)
  })
}

const ROOM_TYPE_LABEL: Record<string, string> = { normal: 'Normal', suite: 'Suite' }

/** Genera y descarga un .xlsx con el detalle de reservas del período, más resúmenes por piso y por habitación. */
export async function exportReservationsExcel(reservations: ReservationWithDetails[], periodLabel: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Reserva de lavadora'
  workbook.created = new Date()

  const sorted = [...reservations].sort((a, b) => {
    const fa = a.profiles?.floor ?? ''
    const fb = b.profiles?.floor ?? ''
    if (fa !== fb) return fa.localeCompare(fb)
    const ra = a.profiles?.room_number ?? ''
    const rb = b.profiles?.room_number ?? ''
    if (ra !== rb) return ra.localeCompare(rb, undefined, { numeric: true })
    return a.starts_at.localeCompare(b.starts_at)
  })

  // --- Hoja 1: detalle de reservas ---
  const detail = workbook.addWorksheet('Reservas')
  detail.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Hora inicio', key: 'inicio', width: 12 },
    { header: 'Hora fin', key: 'fin', width: 12 },
    { header: 'Duración (min)', key: 'duracion', width: 14 },
    { header: 'Piso', key: 'piso', width: 12 },
    { header: 'Habitación', key: 'habitacion', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Inquilino', key: 'inquilino', width: 24 },
    { header: 'Teléfono', key: 'telefono', width: 16 },
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
  styleHeaderRow(detail.getRow(1))
  detail.views = [{ state: 'frozen', ySplit: 1 }]
  detail.autoFilter = { from: 'A1', to: 'I1' }

  // --- Hoja 2: resumen por piso ---
  const byFloor = new Map<string, { count: number; minutes: number }>()
  for (const r of sorted) {
    const floor = r.profiles ? FLOOR_LABEL[r.profiles.floor] : 'Sin dato'
    const entry = byFloor.get(floor) ?? { count: 0, minutes: 0 }
    entry.count += 1
    entry.minutes += diffMinutes(r.starts_at, r.ends_at)
    byFloor.set(floor, entry)
  }
  const floorSheet = workbook.addWorksheet('Resumen por piso')
  floorSheet.columns = [
    { header: 'Piso', key: 'piso', width: 16 },
    { header: 'Reservas', key: 'reservas', width: 12 },
    { header: 'Horas totales', key: 'horas', width: 14 },
  ]
  for (const [piso, { count, minutes }] of [...byFloor.entries()].sort((a, b) => b[1].minutes - a[1].minutes)) {
    floorSheet.addRow({ piso, reservas: count, horas: Math.round((minutes / 60) * 10) / 10 })
  }
  styleHeaderRow(floorSheet.getRow(1))

  // --- Hoja 3: resumen por habitación (ranking de uso) ---
  const byRoom = new Map<string, { piso: string; habitacion: string; inquilino: string; count: number; minutes: number }>()
  for (const r of sorted) {
    if (!r.profiles) continue
    const key = `${r.profiles.floor}|${r.profiles.room_number}`
    const entry = byRoom.get(key) ?? {
      piso: FLOOR_LABEL[r.profiles.floor],
      habitacion: r.profiles.room_number,
      inquilino: `${r.profiles.first_name} ${r.profiles.last_name}`,
      count: 0,
      minutes: 0,
    }
    entry.count += 1
    entry.minutes += diffMinutes(r.starts_at, r.ends_at)
    byRoom.set(key, entry)
  }
  const roomSheet = workbook.addWorksheet('Resumen por habitación')
  roomSheet.columns = [
    { header: 'Piso', key: 'piso', width: 16 },
    { header: 'Habitación', key: 'habitacion', width: 12 },
    { header: 'Inquilino', key: 'inquilino', width: 24 },
    { header: 'Reservas', key: 'reservas', width: 12 },
    { header: 'Horas totales', key: 'horas', width: 14 },
  ]
  for (const { piso, habitacion, inquilino, count, minutes } of [...byRoom.values()].sort((a, b) => b.minutes - a.minutes)) {
    roomSheet.addRow({ piso, habitacion, inquilino, reservas: count, horas: Math.round((minutes / 60) * 10) / 10 })
  }
  styleHeaderRow(roomSheet.getRow(1))

  autoFitColumns(detail)
  autoFitColumns(floorSheet)
  autoFitColumns(roomSheet)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reservas-lavadora_${periodLabel}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
