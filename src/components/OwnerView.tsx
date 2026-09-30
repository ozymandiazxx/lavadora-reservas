import { useEffect, useState } from 'react'
import { Phone, ShieldCheck } from 'lucide-react'
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
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-2 text-slate-900">
        <ShieldCheck className="size-5 text-teal-600" strokeWidth={2.2} />
        <h2 className="font-semibold">Panel de la dueña</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5">
        <label htmlFor="owner-week" className="text-sm font-medium text-slate-700">
          Semana de:
        </label>
        <input
          id="owner-week"
          type="date"
          value={pivotDate}
          onChange={(e) => setPivotDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-sm font-medium text-teal-700">
          {weekStart} → {weekEnd}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Fecha y hora</th>
              <th className="px-4 py-3">Inquilino</th>
              <th className="px-4 py-3">Habitación</th>
              <th className="px-4 py-3">Piso</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : reservations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Sin reservas esta semana.
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 even:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {formatShortDateTime(r.starts_at)} – {formatShortTime(r.ends_at)}
                  </td>
                  <td className="px-4 py-3">
                    {r.profiles ? (
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                          {initialsOf(r.profiles.first_name, r.profiles.last_name)}
                        </span>
                        {r.profiles.first_name} {r.profiles.last_name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.profiles?.room_number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.profiles ? FLOOR_LABEL[r.profiles.floor] : '—'}</td>
                  <td className="px-4 py-3">
                    {r.profiles ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROOM_TYPE_STYLE[r.profiles.room_type]}`}
                      >
                        {ROOM_TYPE_LABEL[r.profiles.room_type]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.profiles?.phone ? (
                      <a
                        href={`tel:${r.profiles.phone}`}
                        className="flex items-center gap-1.5 text-teal-700 hover:underline"
                      >
                        <Phone className="size-3.5" strokeWidth={2.2} />
                        {r.profiles.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
