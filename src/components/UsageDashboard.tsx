import { useMemo } from 'react'
import { Droplets, TrendingUp, WashingMachine } from 'lucide-react'
import { addDaysLocal, dateOf, diffMinutes, isoWeekKey } from '@/lib/dateUtils'
import { FLOOR_LABEL, FLOORS } from '@/lib/rooms'
import type { ReservationWithDetails } from '@/lib/types'
import { UsageTrendChart, type TrendPoint } from './UsageTrendChart'

interface UsageDashboardProps {
  reservations: ReservationWithDetails[]
  start: string
  end: string
}

interface RoomUsage {
  key: string
  piso: string
  habitacion: string
  inquilino: string
  minutes: number
  count: number
}

function shortDM(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(d)}/${Number(m)}`
}

function daysBetween(start: string, end: string): string[] {
  const days: string[] = []
  let cur = start
  let guard = 0
  while (cur <= end && guard < 400) {
    days.push(cur)
    cur = addDaysLocal(cur, 1)
    guard += 1
  }
  return days
}

function StatTile({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
      <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-teal-50">
        <Icon className="size-4 text-teal-600" strokeWidth={2.2} />
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
    </div>
  )
}

function BarRow({ label, sublabel, minutes, maxMinutes }: { label: string; sublabel?: string; minutes: number; maxMinutes: number }) {
  const pct = maxMinutes > 0 ? Math.max((minutes / maxMinutes) * 100, 4) : 0
  const hours = Math.round((minutes / 60) * 10) / 10
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-bold text-slate-700">
          {label}
          {sublabel && <span className="ml-1.5 font-normal text-slate-400">{sublabel}</span>}
        </span>
        <span className="shrink-0 text-xs font-bold text-slate-500">{hours} h</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100">
        <div className="h-2.5 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function UsageDashboard({ reservations, start, end }: UsageDashboardProps) {
  const stats = useMemo(() => {
    let totalMinutes = 0
    const byFloor = new Map<string, number>()
    const byRoom = new Map<string, RoomUsage>()
    const tenants = new Set<string>()
    const dailyMinutes = new Map<string, number>()

    for (const r of reservations) {
      const minutes = diffMinutes(r.starts_at, r.ends_at)
      totalMinutes += minutes
      const day = dateOf(r.starts_at)
      dailyMinutes.set(day, (dailyMinutes.get(day) ?? 0) + minutes)
      if (!r.profiles) continue

      tenants.add(`${r.profiles.floor}|${r.profiles.room_number}`)

      const floorLabel = FLOOR_LABEL[r.profiles.floor]
      byFloor.set(floorLabel, (byFloor.get(floorLabel) ?? 0) + minutes)

      const key = `${r.profiles.floor}|${r.profiles.room_number}`
      const entry = byRoom.get(key) ?? {
        key,
        piso: floorLabel,
        habitacion: r.profiles.room_number,
        inquilino: `${r.profiles.first_name} ${r.profiles.last_name}`,
        minutes: 0,
        count: 0,
      }
      entry.minutes += minutes
      entry.count += 1
      byRoom.set(key, entry)
    }

    const floorRows = FLOORS.map((f) => ({ label: FLOOR_LABEL[f], minutes: byFloor.get(FLOOR_LABEL[f]) ?? 0 })).filter(
      (r) => r.minutes > 0,
    )
    const roomRows = [...byRoom.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 8)
    const maxFloorMinutes = Math.max(...floorRows.map((r) => r.minutes), 1)
    const maxRoomMinutes = Math.max(...roomRows.map((r) => r.minutes), 1)

    const allDays = daysBetween(start, end)
    const useWeekly = allDays.length > 31
    let trendPoints: TrendPoint[]
    if (!useWeekly) {
      trendPoints = allDays.map((d) => ({ label: shortDM(d), hours: Math.round(((dailyMinutes.get(d) ?? 0) / 60) * 10) / 10 }))
    } else {
      const weekStarts = [...new Set(allDays.map((d) => isoWeekKey(d)))]
      const weeklyMinutes = new Map<string, number>()
      for (const [d, mins] of dailyMinutes) {
        const wk = isoWeekKey(d)
        weeklyMinutes.set(wk, (weeklyMinutes.get(wk) ?? 0) + mins)
      }
      trendPoints = weekStarts.map((wk) => ({
        label: shortDM(wk),
        hours: Math.round(((weeklyMinutes.get(wk) ?? 0) / 60) * 10) / 10,
      }))
    }

    return {
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalCount: reservations.length,
      tenantCount: tenants.size,
      floorRows,
      roomRows,
      maxFloorMinutes,
      maxRoomMinutes,
      trendPoints,
      trendIsWeekly: useWeekly,
    }
  }, [reservations, start, end])

  if (reservations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
        Sin reservas en este período.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <StatTile icon={Droplets} label="Horas de uso totales" value={`${stats.totalHours} h`} />
        <StatTile icon={WashingMachine} label="Reservas totales" value={String(stats.totalCount)} />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
        <h4 className="mb-0.5 flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <TrendingUp className="size-4 text-teal-600" strokeWidth={2.2} />
          Consumo en el tiempo
        </h4>
        <p className="mb-2 text-xs text-slate-400">
          Horas de uso por {stats.trendIsWeekly ? 'semana' : 'día'} — tocá el gráfico para ver el detalle.
        </p>
        <UsageTrendChart points={stats.trendPoints} />
      </div>

      {stats.floorRows.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
          <h4 className="mb-3 text-sm font-bold text-slate-700">Uso por piso</h4>
          <div className="space-y-3">
            {stats.floorRows
              .sort((a, b) => b.minutes - a.minutes)
              .map((r) => (
                <BarRow key={r.label} label={r.label} minutes={r.minutes} maxMinutes={stats.maxFloorMinutes} />
              ))}
          </div>
        </div>
      )}

      {stats.roomRows.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
          <h4 className="mb-1 text-sm font-bold text-slate-700">Top habitaciones por uso</h4>
          <p className="mb-3 text-xs text-slate-400">Para detectar de dónde viene el consumo de agua y luz.</p>
          <div className="space-y-3">
            {stats.roomRows.map((r) => (
              <BarRow
                key={r.key}
                label={`${r.piso} · Hab. ${r.habitacion}`}
                sublabel={r.inquilino}
                minutes={r.minutes}
                maxMinutes={stats.maxRoomMinutes}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
