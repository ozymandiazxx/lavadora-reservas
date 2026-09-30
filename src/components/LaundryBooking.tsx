import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Clock3, Trash2, WashingMachine } from 'lucide-react'
import { cancelReservation, createReservation, fetchMyReservations, fetchOccupiedRanges } from '@/lib/db'
import {
  combineDateAndTime,
  formatShortDateTime,
  formatShortTime,
  localDateTimeAlreadyPassed,
  rangesOverlap,
  reservationEnd,
  todayLocalISO,
} from '@/lib/dateUtils'
import { classifyReservationError } from '@/lib/errors'
import type { OccupiedRange, Reservation } from '@/lib/types'
import { ToastView, useToast } from './Toast'
import { WeekScheduleGrid } from './WeekScheduleGrid'

const fieldClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'

export function LaundryBooking({ userId }: { userId: string }) {
  const today = todayLocalISO()
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedTime, setSelectedTime] = useState('')
  const [occupiedRanges, setOccupiedRanges] = useState<OccupiedRange[]>([])
  const [myReservations, setMyReservations] = useState<Reservation[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [gridRefreshKey, setGridRefreshKey] = useState(0)
  const { toast, showToast, dismissToast } = useToast()

  const loadMyReservations = useCallback(() => {
    fetchMyReservations(userId).then(({ data }) => setMyReservations(data ?? []))
  }, [userId])

  useEffect(() => {
    loadMyReservations()
  }, [loadMyReservations])

  const loadOccupied = useCallback(() => {
    fetchOccupiedRanges(selectedDate).then(({ data, error }) => {
      if (error) showToast(classifyReservationError(error), 'error')
      setOccupiedRanges(data ?? [])
    })
  }, [selectedDate, showToast])

  useEffect(() => {
    loadOccupied()
  }, [loadOccupied])

  const startsAt = selectedTime ? combineDateAndTime(selectedDate, selectedTime) : null
  const endsAt = startsAt ? reservationEnd(startsAt) : null

  const conflict = useMemo(() => {
    if (!startsAt || !endsAt) return false
    return occupiedRanges.some((r) => rangesOverlap(startsAt, endsAt, r.starts_at, r.ends_at))
  }, [startsAt, endsAt, occupiedRanges])

  const isPast = startsAt ? localDateTimeAlreadyPassed(startsAt) : false

  async function handleReservation() {
    if (!startsAt) return
    setSubmitting(true)
    const { error } = await createReservation(userId, startsAt)
    setSubmitting(false)

    if (error) {
      showToast(classifyReservationError(error), 'error')
      if (error.code === '23P01') loadOccupied()
      return
    }

    showToast('¡Reserva confirmada!', 'success')
    setSelectedTime('')
    loadOccupied()
    loadMyReservations()
    setGridRefreshKey((k) => k + 1)
  }

  async function handleCancel(id: string) {
    const { error } = await cancelReservation(id, userId, false)
    if (error) {
      showToast(classifyReservationError(error), 'error')
      return
    }
    showToast('Reserva cancelada.', 'success')
    loadOccupied()
    loadMyReservations()
    setGridRefreshKey((k) => k + 1)
  }

  function handleSelectSlot(date: string, hour: number) {
    setSelectedDate(date)
    setSelectedTime(`${String(hour).padStart(2, '0')}:00`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <WashingMachine className="size-5 text-teal-600" strokeWidth={2.2} />
            Reservar la lavadora
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Elegí cualquier hora, incluida la madrugada. El ciclo dura 1h45; el sistema no te deja reservar si se
            superpone con otra reserva.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="reservation-date" className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <CalendarDays className="size-4 text-slate-400" strokeWidth={2.2} />
                Fecha
              </label>
              <input
                id="reservation-date"
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="reservation-time" className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Clock3 className="size-4 text-slate-400" strokeWidth={2.2} />
                Hora de inicio
              </label>
              <input
                id="reservation-time"
                type="time"
                step={900}
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              disabled={!startsAt || conflict || isPast || submitting}
              onClick={handleReservation}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {submitting ? 'Reservando…' : 'Reservar'}
            </button>
          </div>

          {startsAt && endsAt && (
            <p
              className={`flex items-center gap-1.5 text-sm ${
                isPast || conflict ? 'text-red-600' : 'text-slate-600'
              }`}
            >
              {(isPast || conflict) && <AlertTriangle className="size-4 shrink-0" strokeWidth={2.2} />}
              Tu turno sería de <strong>{formatShortDateTime(startsAt)}</strong> a{' '}
              <strong>{formatShortDateTime(endsAt)}</strong>
              {isPast && <span>— ese horario ya pasó</span>}
              {!isPast && conflict && <span>— se superpone con otra reserva</span>}
            </p>
          )}

          <div>
            <h3 className="mb-1.5 text-sm font-medium text-slate-700">Calendario de la semana</h3>
            <p className="mb-2 text-xs text-slate-500">
              Tocá una celda libre para cargar esa fecha y hora arriba (aproximada a la hora en punto).
            </p>
            <WeekScheduleGrid selectedDate={selectedDate} onSelectSlot={handleSelectSlot} refreshKey={gridRefreshKey} />
          </div>
        </div>
      </div>

      {myReservations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
          <h2 className="mb-3 font-semibold text-slate-900">Tus reservas activas</h2>
          <ul className="space-y-2">
            {myReservations.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg bg-teal-50/60 px-3 py-2 text-sm text-slate-700"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Clock3 className="size-4 text-teal-600" strokeWidth={2.2} />
                  {formatShortDateTime(r.starts_at)} – {formatShortTime(r.ends_at)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="size-3.5" strokeWidth={2.2} />
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
