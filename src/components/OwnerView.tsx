import { useEffect, useState } from 'react'
import { CalendarDays, Clock3, Phone, ShieldCheck } from 'lucide-react'
import { fetchOwnerReservations } from '@/lib/db'
import { formatShortDateTime, formatShortTime, isoWeekKey, isoWeekRange, todayLocalISO } from '@/lib/dateUtils'
import { FLOOR_LABEL } from '@/lib/rooms'
import type { ReservationWithDetails } from '@/lib/types'

const ROOM_TYPE_LABEL: Record<string, string> = {
  normal: 'Normal',
  suite: 'Suite',
}

const ROOM_TYPE_STYLE: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-600',
  suite: 'bg-amber-100 text-amber-700',
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function OwnerView() {
  const [pivotDate, setPivotDate] = useState(todayLocalISO())
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = isoWeekKey(pivotDate)
  const { end: weekEnd } = isoWeekRange(weekStart)

  useEffect(() => {
    setLoading(true)
    fetchOwnerReservations(weekStart).then(({ data }) => {
      setReservations(data ?? [])
      setLoading(false)
    })
  }, [weekStart])

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div className="flex items-center gap-2 text-slate-900">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-100">
          <ShieldCheck className="size-6 text-teal-700" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold">Panel de la dueña</h2>
          <p className="text-sm text-slate-500">Reservas de la semana</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
        <CalendarDays className="size-4 text-slate-400" strokeWidth={2.2} />
        <input
          id="owner-week"
          type="date"
          value={pivotDate}
          onChange={(e) => setPivotDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
          {weekStart} → {weekEnd}
        </span>
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-500">Cargando…</p>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
          Sin reservas esta semana.
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-sm font-extrabold text-teal-700">
                  {r.profiles ? initialsOf(r.profiles.first_name, r.profiles.last_name) : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">
                    {r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : 'Inquilino'}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 className="size-3" strokeWidth={2.2} />
                    {formatShortDateTime(r.starts_at)} – {formatShortTime(r.ends_at)}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {r.profiles ? FLOOR_LABEL[r.profiles.floor] : '—'} · Hab. {r.profiles?.room_number ?? '—'}
                </span>
                {r.profiles && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ROOM_TYPE_STYLE[r.profiles.room_type]}`}>
                    {ROOM_TYPE_LABEL[r.profiles.room_type]}
                  </span>
                )}
                {r.profiles?.phone && (
                  <a
                    href={`tel:${r.profiles.phone}`}
                    className="ml-auto flex items-center gap-1 text-xs font-bold text-teal-700"
                  >
                    <Phone className="size-3.5" strokeWidth={2.2} />
                    {r.profiles.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
