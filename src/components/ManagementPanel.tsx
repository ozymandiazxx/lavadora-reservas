import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Megaphone, Trash2, Wrench } from 'lucide-react'
import {
  createAnnouncement,
  deleteAnnouncement,
  deleteMaintenance,
  fetchAllProfiles,
  fetchAnnouncements,
  fetchMaintenance,
  updateMaintenance,
} from '@/lib/db'
import { formatDateEs } from '@/lib/dateUtils'
import { CATEGORY_LABEL, MAINTENANCE_STATUS_LABEL, MAINTENANCE_STATUS_STYLE } from '@/lib/maintenance'
import { FLOOR_LABEL } from '@/lib/rooms'
import type { Announcement, MaintenanceRequest, MaintenanceStatus, Profile } from '@/lib/types'
import { openPhoto } from './MaintenanceTenant'
import { Field, Sheet, inputClass } from './Sheet'
import { ToastView, useToast } from './Toast'

type Tab = 'fallas' | 'avisos'
type Filter = 'abiertas' | 'resueltas'

/** Panel de la dueña: reportes de mantenimiento y comunicados a todos los inquilinos. */
export function ManagementPanel() {
  const [tab, setTab] = useState<Tab>('fallas')
  const [requests, setRequests] = useState<MaintenanceRequest[] | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filter, setFilter] = useState<Filter>('abiertas')
  const [responding, setResponding] = useState<{ request: MaintenanceRequest; status: MaintenanceStatus } | null>(null)
  const { toast, showToast, dismissToast } = useToast()

  const load = useCallback(async () => {
    const [m, a, p] = await Promise.all([fetchMaintenance(null), fetchAnnouncements(), fetchAllProfiles()])
    setRequests(m.data ?? [])
    setAnnouncements(a.data ?? [])
    setProfiles(p.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const shown = (requests ?? []).filter((r) => (filter === 'abiertas' ? r.status !== 'resuelto' : r.status === 'resuelto'))
  const openCount = (requests ?? []).filter((r) => r.status !== 'resuelto').length

  async function setStatus(request: MaintenanceRequest, status: MaintenanceStatus, response: string | null) {
    const { error } = await updateMaintenance(request.id, status, response)
    if (error) return showToast('No se pudo actualizar el reporte.', 'error')
    showToast('Reporte actualizado. El inquilino fue avisado.', 'success')
    setResponding(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm shadow-slate-900/5">
        {(
          [
            ['fallas', 'Fallas', Wrench],
            ['avisos', 'Avisos', Megaphone],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
              tab === id ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            <Icon className="size-4" strokeWidth={2.2} />
            {label}
            {id === 'fallas' && openCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{openCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'fallas' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(['abiertas', 'resueltas'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-xl py-2 text-xs font-bold capitalize transition ${
                  filter === f ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-500'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {requests && shown.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
              {filter === 'abiertas' ? 'No hay fallas abiertas. 🎉' : 'Aún no hay fallas resueltas.'}
            </div>
          )}

          <div className="space-y-2">
            {shown.map((m) => {
              const who = profileById.get(m.tenant_id)
              return (
                <div key={m.id} className="rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">
                        {who ? `${who.first_name} ${who.last_name}` : 'Inquilino'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {who ? `${FLOOR_LABEL[who.floor]} · Hab. ${who.room_number} · ` : ''}
                        {CATEGORY_LABEL[m.category]} · {formatDateEs(m.created_at.slice(0, 10))}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${MAINTENANCE_STATUS_STYLE[m.status]}`}>
                      {MAINTENANCE_STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">{m.description}</p>
                  {m.response && <p className="mt-1.5 rounded-xl bg-teal-50 p-2 text-xs text-teal-800">Respuesta: {m.response}</p>}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {m.photo_path && (
                      <button
                        type="button"
                        onClick={() => openPhoto(m.photo_path!)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                      >
                        Ver foto
                      </button>
                    )}
                    {m.status === 'pendiente' && (
                      <button
                        type="button"
                        onClick={() => setStatus(m, 'en_proceso', m.response)}
                        className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
                      >
                        En proceso
                      </button>
                    )}
                    {m.status !== 'resuelto' && (
                      <button
                        type="button"
                        onClick={() => setResponding({ request: m, status: 'resuelto' })}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Marcar resuelto
                      </button>
                    )}
                    {m.status === 'resuelto' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('¿Eliminar este reporte?')) deleteMaintenance(m.id).then(load)
                        }}
                        className="ml-auto text-xs font-bold text-slate-400"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <AnnouncementsTab
          announcements={announcements}
          onChanged={load}
          onError={(m) => showToast(m, 'error')}
          onDone={(m) => showToast(m, 'success')}
        />
      )}

      {responding && (
        <ResponseSheet
          onClose={() => setResponding(null)}
          onSave={(text) => setStatus(responding.request, responding.status, text || null)}
        />
      )}

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

function ResponseSheet({ onClose, onSave }: { onClose: () => void; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(text.trim())
    setSaving(false)
  }

  return (
    <Sheet title="Marcar como resuelto" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Mensaje para el inquilino (opcional)">
          <input
            type="text"
            maxLength={200}
            placeholder="Ej: Ya se reparó la llave."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? 'Guardando…' : 'Marcar resuelto'}
        </button>
      </form>
    </Sheet>
  )
}

function AnnouncementsTab({
  announcements,
  onChanged,
  onError,
  onDone,
}: {
  announcements: Announcement[]
  onChanged: () => void
  onError: (message: string) => void
  onDone: (message: string) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    const { error } = await createAnnouncement(title.trim(), body.trim())
    setSending(false)
    if (error) return onError('No se pudo publicar el aviso.')
    setTitle('')
    setBody('')
    onDone('Aviso publicado. Les llegó a todos los inquilinos.')
    onChanged()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
        <p className="text-sm font-bold text-slate-700">Nuevo aviso para todos</p>
        <input
          type="text"
          required
          minLength={3}
          maxLength={80}
          placeholder="Título (ej: Reunión de inquilinos)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
        <textarea
          required
          minLength={3}
          maxLength={800}
          rows={3}
          placeholder="Mensaje"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={sending} className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white disabled:opacity-50">
          {sending ? 'Publicando…' : 'Publicar y notificar a todos'}
        </button>
      </form>

      <div className="space-y-2">
        {announcements.map((a) => (
          <div key={a.id} className="rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400">{formatDateEs(a.created_at.slice(0, 10))}</p>
              </div>
              <button
                type="button"
                aria-label="Eliminar aviso"
                onClick={() => {
                  if (window.confirm('¿Eliminar este aviso?')) deleteAnnouncement(a.id).then(onChanged)
                }}
                className="rounded-full p-1.5 text-slate-300 hover:bg-slate-100"
              >
                <Trash2 className="size-4" strokeWidth={2.2} />
              </button>
            </div>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
