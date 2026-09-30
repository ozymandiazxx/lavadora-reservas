import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Clock3, Download, Phone, ShieldCheck } from 'lucide-react'
import { fetchOwnerReservations } from '@/lib/db'
import {
  formatShortDateTime,
  formatShortTime,
  isoWeekKey,
  isoWeekRange,
  monthRange,
  addDaysLocal,
  todayLocalISO,
} from '@/lib/dateUtils'
import { FLOOR_LABEL } from '@/lib/rooms'
import type { ReservationWithDetails } from '@/lib/types'
import { UsageDashboard } from './UsageDashboard'

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

type Period = 'week' | 'month' | '3months' | 'custom'

const PERIOD_LABEL: Record<Period, string> = {
  week: 'Esta semana',
  month: 'Este mes',
  '3months': 'Últimos 3 meses',
  custom: 'Personalizado',
}

export function OwnerView() {
  const today = todayLocalISO()
  const [period, setPeriod] = useState<Period>('week')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { start, end } = useMemo(() => {
    switch (period) {
      case 'week': {
        const weekStart = isoWeekKey(today)
        return { start: weekStart, end: isoWeekRange(weekStart).end }
      }
      case 'month':
        return monthRange(today)
      case '3months':
        return { start: addDaysLocal(today, -89), end: today }
      case 'custom':
        return { start: customFrom, end: customTo }
    }
  }, [period, today, customFrom, customTo])

  useEffect(() => {
    setLoading(true)
    fetchOwnerReservations(start, end).then(({ data }) => {
      setReservations(data ?? [])
      setLoading(false)
    })
  }, [start, end])

  async function handleExport() {
    setExporting(true)
    try {
      const { exportReservationsExcel } = await import('@/lib/exportExcel')
      await exportReservationsExcel(reservations, `${start}_a_${end}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div className="flex items-center gap-2 text-slate-900">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-100">
          <ShieldCheck className="size-6 text-teal-700" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold">Panel de la dueña</h2>
          <p className="text-sm text-slate-500">
            {start} → {end}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-900/5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-xl py-2 text-xs font-bold transition ${
                period === p ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <span className="text-slate-400">–</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting || reservations.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-40"
      >
        <Download className="size-4" strokeWidth={2.2} />
        {exporting ? 'Generando…' : 'Descargar reporte Excel'}
      </button>

      {loading ? (
        <p className="text-center text-sm text-slate-500">Cargando…</p>
      ) : (
        <UsageDashboard reservations={reservations} />
      )}

      {!loading && reservations.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm shadow-slate-900/5"
          >
            <span>Ver detalle de reservas ({reservations.length})</span>
            <ChevronDown className={`size-4 text-slate-400 transition ${showDetail ? 'rotate-180' : ''}`} strokeWidth={2.2} />
          </button>

          {showDetail && (
            <div className="mt-2 space-y-2">
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
      )}
    </div>
  )
}
