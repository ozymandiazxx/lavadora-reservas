import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ImagePlus, MapPin, Package, PackageSearch, Phone, RotateCcw, Trash2, X } from 'lucide-react'
import { createLostFoundReport, deleteLostFoundReport, fetchLostFoundBoard, setLostFoundResolved } from '@/lib/db'
import { classifyReservationError } from '@/lib/errors'
import type { LostFoundReport, LostFoundType } from '@/lib/types'
import { ToastView, useToast } from './Toast'

const TYPE_LABEL: Record<LostFoundType, string> = {
  perdido: 'Perdido',
  encontrado: 'Encontrado',
}

const TYPE_STYLE: Record<LostFoundType, string> = {
  perdido: 'bg-amber-100 text-amber-700',
  encontrado: 'bg-emerald-100 text-emerald-700',
}

export function LostFound({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const [reports, setReports] = useState<LostFoundReport[]>([])
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState<LostFoundType>('perdido')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast, showToast, dismissToast } = useToast()

  const loadBoard = useCallback(() => {
    setLoading(true)
    fetchLostFoundBoard().then(({ data, error }) => {
      if (error) showToast(classifyReservationError(error), 'error')
      setReports(data ?? [])
      setLoading(false)
    })
  }, [showToast])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  function clearPhoto() {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    const { error } = await createLostFoundReport(userId, reportType, description.trim(), location.trim() || null, photo)
    setSubmitting(false)
    if (error) {
      showToast(classifyReservationError(error), 'error')
      return
    }
    showToast('Reporte publicado.', 'success')
    setDescription('')
    setLocation('')
    clearPhoto()
    loadBoard()
  }

  async function handleToggleResolved(report: LostFoundReport) {
    const { error } = await setLostFoundResolved(report.id, !report.resolved, userId, isOwner)
    if (error) {
      showToast(classifyReservationError(error), 'error')
      return
    }
    loadBoard()
  }

  async function handleDelete(report: LostFoundReport) {
    const { error } = await deleteLostFoundReport(report.id, userId, isOwner)
    if (error) {
      showToast(classifyReservationError(error), 'error')
      return
    }
    showToast('Reporte eliminado.', 'success')
    loadBoard()
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-100">
            <PackageSearch className="size-6 text-amber-600" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Objetos perdidos</h2>
            <p className="text-sm text-slate-500">Ayudemos a que las cosas vuelvan a su dueño</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm shadow-slate-900/5">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setReportType('perdido')}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${
              reportType === 'perdido' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
            }`}
          >
            Perdí algo
          </button>
          <button
            type="button"
            onClick={() => setReportType('encontrado')}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${
              reportType === 'encontrado' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
            }`}
          >
            Encontré algo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="lf-description" className="mb-1 block text-xs font-semibold text-slate-500">
              Descripción de la prenda u objeto
            </label>
            <div className="flex items-start gap-2">
              <textarea
                id="lf-description"
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: remera blanca con logo azul"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
              />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              {photoPreview ? (
                <div className="relative shrink-0">
                  <img src={photoPreview} alt="Vista previa" className="size-16 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-slate-800 text-white"
                    aria-label="Quitar foto"
                  >
                    <X className="size-3" strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400"
                >
                  <ImagePlus className="size-5" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold">Foto</span>
                </button>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="lf-location" className="mb-1 block text-xs font-semibold text-slate-500">
              ¿Dónde? (opcional)
            </label>
            <input
              id="lf-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: tendedero, lavadora, secadora"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/25 transition hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? 'Publicando…' : 'Publicar reporte'}
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-2 px-1 text-sm font-bold text-slate-700">Reportes de la comunidad</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
            Todavía no hay reportes.
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const canManage = r.reporter_id === userId || isOwner
              return (
                <div
                  key={r.id}
                  className={`rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5 ${r.resolved ? 'opacity-60' : ''}`}
                >
                  <div className="flex gap-3">
                    {r.photo_url ? (
                      <img src={r.photo_url} alt={r.description} className="size-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <Package className="size-6 text-slate-300" strokeWidth={1.8} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TYPE_STYLE[r.report_type]}`}>
                          {TYPE_LABEL[r.report_type]}
                        </span>
                        {r.resolved && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                            Resuelto
                          </span>
                        )}
                      </div>
                      <p className="truncate font-bold text-slate-800">{r.description}</p>
                      {r.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="size-3 shrink-0" strokeWidth={2.2} />
                          {r.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
                    <span className="text-slate-500">
                      {r.first_name} {r.last_name} · Hab. {r.room_number}
                    </span>
                    <a href={`tel:${r.phone}`} className="flex items-center gap-1 font-bold text-teal-700">
                      <Phone className="size-3.5" strokeWidth={2.2} />
                      {r.phone}
                    </a>
                  </div>

                  {canManage && (
                    <div className="mt-2 flex gap-4 border-t border-slate-100 pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleResolved(r)}
                        className="flex items-center gap-1 font-semibold text-slate-500"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={2.2} />
                        {r.resolved ? 'Reabrir' : 'Marcar resuelto'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="flex items-center gap-1 font-semibold text-red-600"
                      >
                        <Trash2 className="size-3.5" strokeWidth={2.2} />
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
