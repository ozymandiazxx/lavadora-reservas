import { addDaysLocal, todayLocalISO } from '@/lib/dateUtils'

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface DateSelectorProps {
  selectedDate: string
  onSelect: (date: string) => void
  days?: number
}

export function DateSelector({ selectedDate, onSelect, days = 10 }: DateSelectorProps) {
  const today = todayLocalISO()
  const dates = Array.from({ length: days }, (_, i) => addDaysLocal(today, i))

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {dates.map((d) => {
        const [, , day] = d.split('-').map(Number)
        const weekday = WEEKDAY_SHORT[new Date(d + 'T00:00:00').getDay()]
        const active = d === selectedDate
        const isToday = d === today
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            className={`flex min-w-14 shrink-0 flex-col items-center gap-0.5 rounded-2xl px-3 py-2.5 transition ${
              active ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            <span className={`text-[11px] font-semibold ${active ? 'text-teal-50' : 'text-slate-400'}`}>
              {isToday ? 'Hoy' : weekday}
            </span>
            <span className="text-lg font-extrabold">{day}</span>
          </button>
        )
      })}
    </div>
  )
}
