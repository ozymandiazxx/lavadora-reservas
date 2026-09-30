import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchOccupiedRangesForWeek } from '@/lib/db'
import { addDaysLocal, formatShortTime, isoWeekKey, todayLocalISO, weekDates, weekdayShortLabel } from '@/lib/dateUtils'
import type { OccupiedRange } from '@/lib/types'

interface WeekAgendaProps {
  selectedDate: string
  onSelectDate: (date: string) => void
  refreshKey: number
}

/** Agenda compacta de la semana: solo muestra los horarios ya reservados por día, sin la grilla de 24hs. */
export function WeekScheduleGrid({ selectedDate, onSelectDate, refreshKey }: WeekAgendaProps) {
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

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-900/5">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <button
          type="button"
          onClick={goPrevWeek}
          disabled={!canGoPrev}
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="size-4" strokeWidth={2.2} />
        </button>
        <span className="text-xs font-bold text-slate-600">
          {days[0].slice(5)} – {days[6].slice(5)}
        </span>
        <button
          type="button"
          onClick={goNextWeek}
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          aria-label="Semana siguiente"
        >
          <ChevronRight className="size-4" strokeWidth={2.2} />
        </button>
      </div>

      {loading ? (
        <p className="px-3 py-4 text-center text-sm text-slate-500">Cargando…</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {days.map((d) => {
            const ranges = [...(rangesByDate[d] ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
            const active = d === selectedDate
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDate(d)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${active ? 'bg-teal-50' : ''}`}
              >
                <span className={`w-12 shrink-0 text-xs font-bold ${active ? 'text-teal-700' : 'text-slate-500'}`}>
                  {weekdayShortLabel(d)}
                </span>
                {ranges.length === 0 ? (
                  <span className="text-xs font-semibold text-emerald-600">Libre todo el día</span>
                ) : (
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {ranges.map((r, i) => (
                      <span key={i} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-500">
                        {formatShortTime(r.starts_at)}–{formatShortTime(r.ends_at)}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
