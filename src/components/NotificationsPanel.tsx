import { Bell, Check, X } from 'lucide-react'
import { formatShortInstant } from '@/lib/dateUtils'
import type { AppNotification } from '@/lib/types'

interface NotificationsPanelProps {
  notifications: AppNotification[]
  onClose: () => void
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

export function NotificationsPanel({ notifications, onClose, onMarkRead, onMarkAllRead }: NotificationsPanelProps) {
  const hasUnread = notifications.some((n) => !n.read)

  return (
    <div className="fixed inset-0 z-40 flex animate-[fade-in_0.15s_ease-out] items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[80vh] w-full max-w-sm animate-[slide-up_0.2s_ease-out] overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="flex items-center gap-1.5 text-lg font-extrabold text-slate-900">
            <Bell className="size-5 text-teal-600" strokeWidth={2.2} />
            Notificaciones
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Cerrar">
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        {hasUnread && (
          <button type="button" onClick={onMarkAllRead} className="w-full border-b border-slate-100 py-2.5 text-center text-xs font-bold text-teal-700">
            Marcar todas como leídas
          </button>
        )}

        <div className="max-h-[60vh] overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {notifications.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-slate-400">Todavía no tenés notificaciones.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read && onMarkRead(n.id)}
                  className={`w-full rounded-2xl p-3 text-left transition ${n.read ? 'bg-slate-50' : 'bg-teal-50'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-600" />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.read ? 'font-semibold text-slate-600' : 'font-extrabold text-slate-900'}`}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatShortInstant(n.created_at)}</p>
                    </div>
                    {n.read && <Check className="mt-0.5 size-3.5 shrink-0 text-slate-300" strokeWidth={2.2} />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
