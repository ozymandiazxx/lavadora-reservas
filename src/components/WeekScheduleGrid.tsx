import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchOccupiedRangesForWeek } from '@/lib/db'
import {
  addDaysLocal,
  addMinutesLocal,
  combineDateAndTime,
  isoWeekKey,
  localDateTimeAlreadyPassed,
  rangesOverlap,
  todayLocalISO,
  weekDates,
  weekdayShortLabel,
} from '@/lib/dateUtils'
import type { OccupiedRange } from '@/lib/types'

const HOURS = Array.from({ length: 24 }, (_, h) => h)

interface WeekScheduleGridProps {
  selectedDate: string
  onSelectSlot: (date: string, hour: number) => void
  refreshKey: number
}

export function WeekScheduleGrid({ selectedDate, onSelectSlot, refreshKey }: WeekScheduleGridProps) {
  const today = todayLocalISO()
  const [weekStart, setWeekStart] = useState(isoWeekKey(selectedDate))
  const [rangesByDate, setRangesByDate] = useState<Record<string, OccupiedRange[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setWeekStart(isoWeekKey(selectedDate))
  }, [selectedDate])

  useEffect(() => {
    setLoading(true)
    fetchOccupiedRangesForWeek(weekStart).then(({ data }) => {
      setRangesByDate(data ?? {})
      setLoading(false)
    })
  }, [weekStart, refreshKey])

  const days = weekDates(weekStart)
  const canGoPrev = addDaysLocal(weekStart, -1) >= today
  const goPrevWeek = () => canGoPrev && setWeekStart(addDaysLocal(weekStart, -7))
  const goNextWeek = () => setWeekStart(addDaysLocal(weekStart, 7))

  function hourStatus(date: string, hour: number): 'past' | 'occupied' | 'free' {
    const hourStart = combineDateAndTime(date, `${String(hour).padStart(2, '0')}:00`)
    const hourEnd = addMinutesLocal(hourStart, 60)
    if (localDateTimeAlreadyPassed(hourEnd)) return 'past'
    const ranges = rangesByDate[date] ?? []
    if (ranges.some((r) => rangesOverlap(hourStart, hourEnd, r.starts_at, r.ends_at))) return 'occupied'
    return 'free'
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={goPrevWeek}
          disabled={!canGoPrev}
          className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="size-4" strokeWidth={2.2} />
        </button>
        <span className="text-xs font-semibold text-slate-600">
          {weekDates(weekStart)[0].slice(5)} – {weekDates(weekStart)[6].slice(5)}
        </span>
        <button
          type="button"
          onClick={goNextWeek}
          className="rounded p-1 text-slate-500 hover:bg-slate-200"
          aria-label="Semana siguiente"
        >
          <ChevronRight className="size-4" strokeWidth={2.2} />
        </button>
      </div>

      {loading ? (
        <p className="px-3 py-4 text-center text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <p className="px-3 pt-2 text-[11px] text-slate-400 sm:hidden">Deslizá hacia los costados para ver toda la semana →</p>
          <div className="max-h-96 overflow-auto overscroll-contain">
            <table className="w-full min-w-[460px] border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 w-10 border-b border-slate-200 bg-slate-50 px-1 py-2"></th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={`sticky top-0 z-10 min-w-[54px] border-b border-l border-slate-200 px-1 py-2 font-semibold ${
                        d === today ? 'bg-teal-50 text-teal-700' : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {weekdayShortLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-1 py-1 text-slate-400">
                      {String(hour).padStart(2, '0')}h
                    </td>
                    {days.map((d) => {
                      const status = hourStatus(d, hour)
                      return (
                        <td key={d} className="border-b border-l border-slate-100 p-0.5">
                          <button
                            type="button"
                            disabled={status !== 'free'}
                            onClick={() => onSelectSlot(d, hour)}
                            title={`${weekdayShortLabel(d)} ${String(hour).padStart(2, '0')}:00`}
                            className={`h-7 w-full rounded transition active:scale-95 ${
                              status === 'free'
                                ? 'bg-emerald-50 hover:bg-teal-200'
                                : status === 'occupied'
                                  ? 'bg-rose-300'
                                  : 'bg-slate-100'
                            }`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-emerald-50 ring-1 ring-slate-300" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-rose-300" /> Ocupado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded bg-slate-100" /> Pasado
        </span>
      </div>
    </div>
  )
}
