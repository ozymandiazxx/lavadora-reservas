import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Camera, Wrench } from 'lucide-react'
import { createMaintenance, deleteMaintenance, fetchMaintenance, getMaintenancePhotoUrl } from '@/lib/db'
import { formatDateEs } from '@/lib/dateUtils'
import { CATEGORIES, CATEGORY_LABEL, MAINTENANCE_STATUS_LABEL, MAINTENANCE_STATUS_STYLE } from '@/lib/maintenance'
import type { MaintenanceCategory, MaintenanceRequest } from '@/lib/types'
import { Field, inputClass } from './Sheet'
import { ToastView, useToast } from './Toast'

export async function openPhoto(path: string) {
  const url = await getMaintenancePhotoUrl(path)
  if (url) window.open(url, '_blank', 'noopener')
}

/** Pantalla del inquilino para reportar fallas y seguir su estado. */
export function MaintenanceTenant({ userId }: { userId: string }) {
  const [items, setItems] = useState<MaintenanceRequest[] | null>(null)
  const [category, setCategory] = useState<MaintenanceCategory>('lavadora')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const { toast, showToast, dismissToast } = useToast()

  const load = useCallback(() => {
    fetchMaintenance(userId).then(({ data }) => setItems(data ?? []))
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    const { error } = await createMaintenance(userId, category, description.trim(), photo)
    setSending(false)
    if (error) return showToast('No se pudo enviar el reporte. Intenta de nuevo.', 'error')
    setDescription('')
    setPhoto(null)
    ;(e.target as HTMLFormElement).reset()
    showToast('Reporte enviado. La dueña fue avisada.', 'success')
    load()
  }

  async function handleCancel(id: string) {
    await deleteMaintenance(id)
    load()
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 p-4 text-white shadow-lg shadow-slate-900/20">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <Wrench className="size-6" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold">Reportar un problema</h2>
          <p className="text-sm text-slate-300">Fallas de la lavadora, luz, agua y más</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl bg-white p-4 shadow-sm shadow-slate-900/5">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                category === c ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        <Field label="¿Qué está pasando?">
          <textarea
            required
            minLength={3}
            maxLength={600}
            rows={3}
            placeholder="Ej: La lavadora 2 no desagua y deja el agua adentro."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-500">
          <Camera className="size-4 shrink-0" strokeWidth={2.2} />
          <span className="truncate">{photo ? photo.name : 'Agregar foto (opcional)'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>

        <button type="submit" disabled={sending} className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white disabled:opacity-50">
          {sending ? 'Enviando…' : 'Enviar reporte'}
        </button>
      </form>

      <div>
        <h3 className="mb-2 px-1 text-sm font-bold text-slate-700">Mis reportes</h3>
        {items && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-sm text-slate-400">
            No has reportado nada todavía.
          </div>
        )}
        <div className="space-y-2">
          {items?.map((m) => (
            <div key={m.id} className="rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-400">
                  {CATEGORY_LABEL[m.category]} · {formatDateEs(m.created_at.slice(0, 10))}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${MAINTENANCE_STATUS_STYLE[m.status]}`}>
                  {MAINTENANCE_STATUS_LABEL[m.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{m.description}</p>
              {m.response && (
                <p className="mt-2 rounded-xl bg-teal-50 p-2.5 text-xs text-teal-800">
                  <b>Respuesta:</b> {m.response}
                </p>
              )}
              <div className="mt-2 flex gap-3 text-xs font-bold">
                {m.photo_path && (
                  <button type="button" onClick={() => openPhoto(m.photo_path!)} className="text-teal-700">
                    Ver foto
                  </button>
                )}
                {m.status === 'pendiente' && (
                  <button type="button" onClick={() => handleCancel(m.id)} className="ml-auto text-slate-400">
                    Cancelar reporte
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
