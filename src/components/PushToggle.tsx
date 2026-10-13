import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push'

const HINT: Partial<Record<PushState, string>> = {
  'ios-install': 'En iPhone: toca Compartir → "Agregar a pantalla de inicio" y abre la app desde ahí para activar los avisos.',
  denied: 'Bloqueaste los avisos en este navegador. Actívalos desde los ajustes del sitio.',
}

/** Interruptor para recibir los avisos de la app como notificaciones del celular. */
export function PushToggle({ userId }: { userId: string }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPushState().then(setState)
  }, [])

  if (!state || state === 'unsupported') return null

  async function toggle() {
    setBusy(true)
    setError(null)
    if (state === 'on') {
      await disablePush()
    } else {
      setError(await enablePush(userId))
    }
    setState(await getPushState())
    setBusy(false)
  }

  const interactive = state === 'on' || state === 'off'

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
      <div className="flex items-center gap-3">
        <BellRing className="size-5 text-slate-400" strokeWidth={2} />
        <div className="flex-1">
          <p className="font-semibold text-slate-700">Avisos en el celular</p>
          <p className="text-xs text-slate-400">Recibe reservas, cobros y pagos aunque la app esté cerrada.</p>
        </div>
        {interactive && (
          <button
            type="button"
            role="switch"
            aria-checked={state === 'on'}
            disabled={busy}
            onClick={toggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${state === 'on' ? 'bg-teal-600' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition ${state === 'on' ? 'translate-x-5' : ''}`} />
          </button>
        )}
      </div>
      {HINT[state] && <p className="mt-2 text-xs font-semibold text-amber-600">{HINT[state]}</p>}
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  )
}
