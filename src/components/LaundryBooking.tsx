import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronDown, Clock3, Trash2, WashingMachine } from 'lucide-react'
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
import { ConfirmBookingModal } from './ConfirmBookingModal'
import { DateSelector } from './DateSelector'
import { ToastView, useToast } from './Toast'
import { WeekScheduleGrid } from './WeekScheduleGrid'

export function LaundryBooking({ userId }: { userId: string }) {
  const today = todayLocalISO()
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedTime, setSelectedTime] = useState('')
  const [occupiedRanges, setOccupiedRanges] = useState<OccupiedRange[]>([])
  const [myReservations, setMyReservations] = useState<Reservation[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showWeekGrid, setShowWeekGrid] = useState(false)
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

  async function handleConfirmReservation() {
    if (!startsAt) return
    setSubmitting(true)
    const { error } = await createReservation(userId, startsAt)
    setSubmitting(false)

    if (error) {
      showToast(classifyReservationError(error), 'error')
      if (error.code === '23P01') loadOccupied()
      return
    }

    setShowConfirm(false)
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

  function handleSelectGridSlot(date: string, hour: number) {
    setSelectedDate(date)
    setSelectedTime(`${String(hour).padStart(2, '0')}:00`)
    setShowWeekGrid(false)
  }

  const sortedRanges = useMemo(() => [...occupiedRanges].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [occupiedRanges])

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 p-5 text-white shadow-lg shadow-teal-900/20">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-white/15">
            <WashingMachine className="size-6" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Reserva de lavadora</h2>
            <p className="text-sm text-teal-50/90">Elegí un horario disponible</p>
          </div>
        </div>
      </div>

      <DateSelector selectedDate={selectedDate} onSelect={setSelectedDate} />

      <div className="rounded-3xl bg-white p-4 shadow-sm shadow-slate-900/5">
        <div className="mb-3 flex items-center gap-1.5">
          <Clock3 className="size-4 text-slate-400" strokeWidth={2.2} />
          <h3 className="text-sm font-bold text-slate-700">Elegí la hora de inicio</h3>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="time"
            step={900}
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
          />
          <button
            type="button"
            disabled={!startsAt || conflict || isPast}
            onClick={() => setShowConfirm(true)}
            className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/25 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            Reservar
          </button>
        </div>

        {startsAt && endsAt && (
          <p className={`mt-3 flex items-center gap-1.5 text-sm ${isPast || conflict ? 'text-red-600' : 'text-slate-500'}`}>
            {isPast || conflict ? (
              <AlertTriangle className="size-4 shrink-0" strokeWidth={2.2} />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" strokeWidth={2.2} />
            )}
            {isPast
              ? 'Ese horario ya pasó.'
              : conflict
                ? 'Se superpone con otra reserva.'
                : `Ciclo de 1h45: ${formatShortTime(startsAt)} – ${formatShortTime(endsAt)}`}
          </p>
        )}

        <p className="mt-2 text-xs text-slate-400">Cada ciclo de lavado/secado dura 1h45.</p>
      </div>

      <div>
        <h3 className="mb-2 px-1 text-sm font-bold text-slate-700">Horarios ocupados este día</h3>
        {sortedRanges.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-sm text-slate-400">
            Sin reservas ese día — ¡está todo libre!
          </div>
        ) : (
          <div className="space-y-2">
            {sortedRanges.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                  <WashingMachine className="size-5 text-rose-400" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">
                    {formatShortTime(r.starts_at)} – {formatShortTime(r.ends_at)}
                  </p>
                  <p className="text-xs text-slate-400">Lavadora</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-500">
                  <span className="size-1.5 rounded-full bg-rose-400" /> Ocupado
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowWeekGrid((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm shadow-slate-900/5"
      >
        <span className="flex items-center gap-1.5">
          <CalendarRange className="size-4 text-slate-400" strokeWidth={2.2} />
          Ver calendario de la semana
        </span>
        <ChevronDown className={`size-4 text-slate-400 transition ${showWeekGrid ? 'rotate-180' : ''}`} strokeWidth={2.2} />
      </button>
      {showWeekGrid && (
        <WeekScheduleGrid selectedDate={selectedDate} onSelectSlot={handleSelectGridSlot} refreshKey={gridRefreshKey} />
      )}

      {myReservations.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-sm font-bold text-slate-700">Tus reservas activas</h3>
          <div className="space-y-2">
            {myReservations.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-teal-50 p-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
                  <Clock3 className="size-5" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">{formatShortDateTime(r.starts_at)}</p>
                  <p className="text-xs text-slate-500">hasta las {formatShortTime(r.ends_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-600 shadow-sm"
                >
                  <Trash2 className="size-3.5" strokeWidth={2.2} />
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showConfirm && startsAt && endsAt && (
        <ConfirmBookingModal
          startsAt={startsAt}
          endsAt={endsAt}
          submitting={submitting}
          onConfirm={handleConfirmReservation}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
