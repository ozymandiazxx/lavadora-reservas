import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MapPin, Phone, PackageSearch, RotateCcw, Search, Trash2 } from 'lucide-react'
import {
  createLostFoundReport,
  deleteLostFoundReport,
  fetchLostFoundBoard,
  setLostFoundResolved,
} from '@/lib/db'
import { classifyReservationError } from '@/lib/errors'
import type { LostFoundReport, LostFoundType } from '@/lib/types'
import { ToastView, useToast } from './Toast'

const TYPE_LABEL: Record<LostFoundType, string> = {
  perdido: 'Perdido',
  encontrado: 'Encontrado',
}

const TYPE_STYLE: Record<LostFoundType, string> = {
  perdido: 'bg-amber-100 text-amber-800',
  encontrado: 'bg-emerald-100 text-emerald-800',
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'

export function LostFound({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const [reports, setReports] = useState<LostFoundReport[]>([])
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState<LostFoundType>('perdido')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    const { error } = await createLostFoundReport(userId, reportType, description.trim(), location.trim() || null)
    setSubmitting(false)
    if (error) {
      showToast(classifyReservationError(error), 'error')
      return
    }
    showToast('Reporte publicado.', 'success')
    setDescription('')
    setLocation('')
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
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <PackageSearch className="size-5 text-teal-600" strokeWidth={2.2} />
            Reportar prenda perdida o encontrada
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReportType('perdido')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                reportType === 'perdido' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Perdí algo
            </button>
            <button
              type="button"
              onClick={() => setReportType('encontrado')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                reportType === 'encontrado'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Encontré algo
            </button>
          </div>
          <div>
            <label htmlFor="lf-description" className="mb-1 block text-sm font-medium text-slate-700">
              Descripción de la prenda
            </label>
            <textarea
              id="lf-description"
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: remera blanca con logo azul"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="lf-location" className="mb-1 block text-sm font-medium text-slate-700">
              Dónde (opcional)
            </label>
            <input
              id="lf-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: tendedero, lavadora, secadora"
              className={fieldClass}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? 'Publicando…' : 'Publicar reporte'}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Search className="size-4 text-slate-400" strokeWidth={2.2} />
          Reportes de la comunidad
        </h2>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Todavía no hay reportes.
          </p>
        ) : (
          reports.map((r) => {
            const canManage = r.reporter_id === userId || isOwner
            return (
              <div
                key={r.id}
                className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 ${
                  r.resolved ? 'opacity-60' : ''
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLE[r.report_type]}`}>
                    {TYPE_LABEL[r.report_type]}
                  </span>
                  {r.resolved && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                      Resuelto
                    </span>
                  )}
                </div>
                <p className="text-slate-800">{r.description}</p>
                {r.location && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="size-3.5" strokeWidth={2.2} />
                    {r.location}
                  </p>
                )}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span>
                    {r.first_name} {r.last_name} · Hab. {r.room_number}
                  </span>
                  <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-teal-700 hover:underline">
                    <Phone className="size-3.5" strokeWidth={2.2} />
                    {r.phone}
                  </a>
                </p>
                {canManage && (
                  <div className="mt-3 flex gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() => handleToggleResolved(r)}
                      className="flex items-center gap-1 text-slate-600 hover:underline"
                    >
                      <RotateCcw className="size-3.5" strokeWidth={2.2} />
                      {r.resolved ? 'Reabrir' : 'Marcar resuelto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="flex items-center gap-1 text-red-600 hover:underline"
                    >
                      <Trash2 className="size-3.5" strokeWidth={2.2} />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
