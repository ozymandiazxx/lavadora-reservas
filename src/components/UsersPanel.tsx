import { useEffect, useMemo, useState } from 'react'
import { Phone, Search, ShieldCheck, Users } from 'lucide-react'
import { fetchAllProfiles } from '@/lib/db'
import { FLOOR_LABEL, FLOORS } from '@/lib/rooms'
import type { Profile } from '@/lib/types'

const ROOM_TYPE_LABEL: Record<string, string> = { normal: 'Normal', suite: 'Suite' }
const ROOM_TYPE_STYLE: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-600',
  suite: 'bg-amber-100 text-amber-700',
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function UsersPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchAllProfiles().then(({ data }) => {
      setProfiles(data ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) =>
      `${p.first_name} ${p.last_name} ${p.room_number} ${p.phone}`.toLowerCase().includes(q),
    )
  }, [profiles, query])

  const byFloor = useMemo(() => {
    const map = new Map<string, Profile[]>()
    for (const f of FLOORS) map.set(f, [])
    for (const p of filtered) {
      const list = map.get(p.floor) ?? []
      list.push(p)
      map.set(p.floor, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }))
    }
    return map
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" strokeWidth={2.2} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, habitación o teléfono"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-3 pl-9 text-sm shadow-sm shadow-slate-900/5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-500">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
          No se encontraron inquilinos.
        </div>
      ) : (
        FLOORS.map((floor) => {
          const list = byFloor.get(floor) ?? []
          if (list.length === 0) return null
          return (
            <div key={floor}>
              <h4 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-slate-700">
                {FLOOR_LABEL[floor]}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  {list.length}
                </span>
              </h4>
              <div className="space-y-2">
                {list.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-extrabold text-teal-700">
                      {initialsOf(p.first_name, p.last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-bold text-slate-800">
                        {p.first_name} {p.last_name}
                        {p.is_owner && <ShieldCheck className="size-3.5 shrink-0 text-teal-600" strokeWidth={2.2} />}
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span>Hab. {p.room_number}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${ROOM_TYPE_STYLE[p.room_type]}`}>
                          {ROOM_TYPE_LABEL[p.room_type]}
                        </span>
                      </p>
                    </div>
                    <a
                      href={`tel:${p.phone}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700"
                      aria-label={`Llamar a ${p.first_name}`}
                    >
                      <Phone className="size-4" strokeWidth={2.2} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      <p className="flex items-center gap-1.5 px-1 text-xs text-slate-400">
        <Users className="size-3.5" strokeWidth={2.2} />
        {profiles.length} inquilinos registrados en total
      </p>
    </div>
  )
}
