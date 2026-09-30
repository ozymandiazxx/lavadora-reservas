import { WashingMachine, X } from 'lucide-react'
import { formatShortDateTime, formatShortTime } from '@/lib/dateUtils'

interface ConfirmBookingModalProps {
  startsAt: string
  endsAt: string
  submitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmBookingModal({ startsAt, endsAt, submitting, onConfirm, onCancel }: ConfirmBookingModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex animate-[fade-in_0.15s_ease-out] items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm animate-[slide-up_0.2s_ease-out] rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-900">Confirmar reserva</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-teal-50 p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
            <WashingMachine className="size-5" strokeWidth={2.2} />
          </div>
          <div>
            <p className="font-bold text-slate-900">{formatShortDateTime(startsAt)}</p>
            <p className="text-sm text-slate-500">hasta las {formatShortTime(endsAt)} · Lavadora</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
