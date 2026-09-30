import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastState {
  message: string
  type: ToastType
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  return { toast, showToast, dismissToast }
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-800',
}

const ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export function ToastView({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  if (!toast) return null
  const Icon = ICONS[toast.type]
  return (
    <div
      role="alert"
      className={`fixed right-4 bottom-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm text-white shadow-lg ${STYLES[toast.type]}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
        <p className="flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="leading-none text-white/80 hover:text-white"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  )
}
