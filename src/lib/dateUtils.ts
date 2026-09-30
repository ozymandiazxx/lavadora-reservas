import { RESERVATION_DURATION_MINUTES } from './constants'

/** Fecha local en formato YYYY-MM-DD (evita el corrimiento de día de toISOString/UTC). */
export function todayLocalISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Hora local en formato HH:mm. */
export function nowLocalHHMM(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Timestamp local completo "YYYY-MM-DDTHH:mm:ss" del momento actual (evita el corrimiento de toISOString/UTC). */
export function nowLocalDateTime(): string {
  return combineDateAndTime(todayLocalISO(), nowLocalHHMM())
}

/** Clave de semana ISO (lunes de esa semana) para una fecha YYYY-MM-DD. */
export function isoWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = (date.getDay() + 6) % 7 // 0 = lunes
  date.setDate(date.getDate() - day)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${dd}`
}

/** Rango [lunes, domingo] de la semana ISO a la que pertenece weekStart (lunes). */
export function isoWeekRange(weekStart: string): { start: string; end: string } {
  const [y, m, d] = weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, d)
  end.setDate(end.getDate() + 6)
  const year = end.getFullYear()
  const month = String(end.getMonth() + 1).padStart(2, '0')
  const dd = String(end.getDate()).padStart(2, '0')
  return { start: weekStart, end: `${year}-${month}-${dd}` }
}

/** Combina fecha (YYYY-MM-DD) y hora (HH:mm) en un timestamp local sin zona horaria. */
export function combineDateAndTime(date: string, time: string): string {
  return `${date}T${time}:00`
}

/** Fecha (YYYY-MM-DD) contenida en un timestamp local "YYYY-MM-DDTHH:mm:ss". */
export function dateOf(localDateTime: string): string {
  return localDateTime.slice(0, 10)
}

function parseLocalDateTime(localDateTime: string): Date {
  const [datePart, timePart] = localDateTime.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, mi, s] = timePart.split(':').map(Number)
  return new Date(y, m - 1, d, h, mi, s ?? 0)
}

function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hh}:${mm}:${ss}`
}

/** Suma minutos a un timestamp local, devolviendo otro timestamp local (puede cruzar medianoche). */
export function addMinutesLocal(localDateTime: string, minutes: number): string {
  const date = parseLocalDateTime(localDateTime)
  date.setMinutes(date.getMinutes() + minutes)
  return formatLocalDateTime(date)
}

/** Fin de un ciclo de lavado que arranca en `startsAt`, según la duración fija del sistema. */
export function reservationEnd(startsAt: string): string {
  return addMinutesLocal(startsAt, RESERVATION_DURATION_MINUTES)
}

/** true si el timestamp local ya pasó respecto al momento actual. */
export function localDateTimeAlreadyPassed(localDateTime: string): boolean {
  return parseLocalDateTime(localDateTime).getTime() <= new Date().getTime()
}

/** true si dos rangos [start, end) se solapan. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return parseLocalDateTime(aStart) < parseLocalDateTime(bEnd) && parseLocalDateTime(bStart) < parseLocalDateTime(aEnd)
}

/** Formato corto para mostrar un timestamp local: "29/09 23:30". */
export function formatShortDateTime(localDateTime: string): string {
  const date = parseLocalDateTime(localDateTime)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month} ${hh}:${mm}`
}

/** Formato corto de solo hora: "23:30". */
export function formatShortTime(localDateTime: string): string {
  const date = parseLocalDateTime(localDateTime)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${dd}`
}

/** Los 7 días (lunes a domingo) de la semana que empieza en `weekStart`. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i))
}

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Nombre corto del día de la semana + número: "Lun 29". */
export function weekdayShortLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${WEEKDAY_SHORT[date.getDay()]} ${d}`
}

/** Primer y último día del mes al que pertenece `dateStr` (YYYY-MM-DD). */
export function monthRange(dateStr: string): { start: string; end: string } {
  const [y, m] = dateStr.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/** Minutos transcurridos entre dos timestamps locales. */
export function diffMinutes(startsAt: string, endsAt: string): number {
  return (parseLocalDateTime(endsAt).getTime() - parseLocalDateTime(startsAt).getTime()) / 60000
}

/** Fecha en formato DD/MM/YYYY para mostrar o exportar. */
export function formatDateEs(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
