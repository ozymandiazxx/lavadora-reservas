import { useEffect, useState } from 'react'
import { Bell, ChevronRight, Clock3 } from 'lucide-react'
import { fetchMyReservations } from '@/lib/db'
import { formatShortDateTime, formatShortTime } from '@/lib/dateUtils'
import { FLOOR_LABEL } from '@/lib/rooms'
import type { Profile, Reservation } from '@/lib/types'
import type { AppTab } from './BottomNavigation'
import { useToast, ToastView } from './Toast'

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function Home({ userId, profile, onNavigate }: { userId: string; profile: Profile; onNavigate: (tab: AppTab) => void }) {
  const [nextReservation, setNextReservation] = useState<Reservation | null>(null)
  const { toast, showToast, dismissToast } = useToast()

  useEffect(() => {
    fetchMyReservations(userId).then(({ data }) => setNextReservation(data?.[0] ?? null))
  }, [userId])

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-teal-100 text-sm font-extrabold text-teal-700">
            {initialsOf(profile.first_name, profile.last_name)}
          </div>
          <div>
            <p className="text-lg font-extrabold text-slate-900">¡Hola, {profile.first_name}! 👋</p>
            <p className="text-sm text-slate-500">
              {FLOOR_LABEL[profile.floor]} · Hab. {profile.room_number}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => showToast('No tenés notificaciones nuevas.', 'info')}
          className="flex size-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm shadow-slate-900/5"
          aria-label="Notificaciones"
        >
          <Bell className="size-5" strokeWidth={2} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onNavigate('booking')}
        className="block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 p-4 pr-5 text-left text-white shadow-lg shadow-teal-900/20 transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <img src="/illustrations/schedule.webp" alt="" className="size-14 shrink-0" width={640} height={640} />
          <div className="flex-1">
            <p className="text-lg font-extrabold">Reserva de lavadora</p>
            <p className="text-sm text-teal-50/90">Elegí un horario disponible</p>
          </div>
          <ChevronRight className="size-5 text-teal-50/80" strokeWidth={2.2} />
        </div>
      </button>

      {nextReservation && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <Clock3 className="size-5 text-emerald-600" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Tu próxima reserva</p>
            <p className="font-bold text-slate-800">
              {formatShortDateTime(nextReservation.starts_at)} – {formatShortTime(nextReservation.ends_at)}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate('lostfound')}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm shadow-slate-900/5 transition active:scale-[0.99]"
      >
        <img src="/illustrations/lost-found.webp" alt="" className="size-12 shrink-0" width={640} height={640} />
        <div className="flex-1">
          <p className="font-bold text-slate-800">Objetos perdidos</p>
          <p className="text-sm text-slate-400">Ayudemos a que las cosas vuelvan a su dueño</p>
        </div>
        <ChevronRight className="size-5 text-slate-300" strokeWidth={2.2} />
      </button>

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
