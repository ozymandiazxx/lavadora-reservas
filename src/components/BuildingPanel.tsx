import { useEffect, useMemo, useState } from 'react'
import { fetchAllProfiles, fetchOwnerReservations, fetchRentData, type RentData } from '@/lib/db'
import { addDaysLocal, diffMinutes, monthRange, todayLocalISO } from '@/lib/dateUtils'
import { STATUS_LABEL, formatMoney, summarizeAll, type ChargeStatus } from '@/lib/rent'
import { FLOORS, FLOOR_LABEL } from '@/lib/rooms'
import type { Floor, Profile, ReservationWithDetails } from '@/lib/types'
import { Building3D, type RoomCell } from './Building3D'

type Mode = 'pagos' | 'consumo'
type UsagePeriod = 'month' | '3months'

const STATUS_COLOR: Record<ChargeStatus, string> = {
  pagado: '#10b981',
  por_revisar: '#0ea5e9',
  pendiente: '#f59e0b',
  vencido: '#f43f5e',
}
const NO_CHARGE_COLOR = '#94a3b8'
const VACANT_COLOR = '#cbd5e1'
const STATUS_RANK: Record<ChargeStatus, number> = { vencido: 0, por_revisar: 1, pendiente: 2, pagado: 3 }

/** Habitaciones numeradas 1-14 en los pisos normales; en suites solo las registradas. */
const NORMAL_ROOMS = Array.from({ length: 14 }, (_, i) => String(i + 1))

function lerpColor(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

interface TenantStats {
  status: ChargeStatus | null
  debt: number
  uses: number
  minutes: number
}

export function BuildingPanel() {
  const today = todayLocalISO()
  const [mode, setMode] = useState<Mode>('pagos')
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriod>('month')
  const [onlyFloor, setOnlyFloor] = useState<Floor | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [rent, setRent] = useState<RentData | null>(null)
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAllProfiles(), fetchRentData(null)]).then(([people, rentData]) => {
      setProfiles((people.data ?? []).filter((p) => !p.is_owner))
      setRent(rentData.data)
      setLoading(false)
    })
  }, [])

  const range = useMemo(
    () => (usagePeriod === 'month' ? monthRange(today) : { start: addDaysLocal(today, -89), end: today }),
    [usagePeriod, today],
  )

  useEffect(() => {
    fetchOwnerReservations(range.start, range.end).then(({ data }) => setReservations(data ?? []))
  }, [range])

  const stats = useMemo(() => {
    const map = new Map<string, TenantStats>()
    const summaries = rent ? summarizeAll(rent.charges, rent.leases, rent.payments, today) : []
    const thisMonth = `${today.slice(0, 7)}-01`
    for (const p of profiles) {
      const mine = summaries.filter((s) => s.charge.tenant_id === p.id)
      let status: ChargeStatus | null = null
      for (const s of mine.filter((x) => x.charge.period === thisMonth)) {
        if (status === null || STATUS_RANK[s.status] < STATUS_RANK[status]) status = s.status
      }
      // Una deuda de meses anteriores cuenta como vencida aunque este mes esté al día.
      if (mine.some((s) => s.charge.period < thisMonth && s.balance > 0)) status = 'vencido'
      map.set(p.id, { status, debt: mine.reduce((sum, s) => sum + s.balance, 0), uses: 0, minutes: 0 })
    }
    for (const r of reservations) {
      const s = map.get(r.tenant_id)
      if (s) {
        s.uses += 1
        s.minutes += diffMinutes(r.starts_at, r.ends_at)
      }
    }
    return map
  }, [profiles, rent, reservations, today])

  const maxUses = Math.max(1, ...[...stats.values()].map((s) => s.uses))

  const cells = useMemo(() => {
    const result: Array<RoomCell & { profile?: Profile }> = []
    for (const floor of FLOORS) {
      const onFloor = profiles.filter((p) => p.floor === floor)
      const byRoom = new Map(onFloor.map((p) => [p.room_number, p]))
      const numbers =
        floor === 'piso_2' || floor === 'piso_3'
          ? [...NORMAL_ROOMS, ...onFloor.map((p) => p.room_number).filter((n) => !NORMAL_ROOMS.includes(n))]
          : onFloor.map((p) => p.room_number).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

      for (const number of numbers) {
        const profile = byRoom.get(number)
        const s = profile ? stats.get(profile.id) : undefined
        let color = VACANT_COLOR
        if (profile && s) {
          if (mode === 'pagos') color = s.status ? STATUS_COLOR[s.status] : NO_CHARGE_COLOR
          else color = s.uses === 0 ? '#e2e8f0' : lerpColor('#99f6e4', '#115e59', s.uses / maxUses)
        }
        result.push({ key: `${floor}-${number}`, floor, number, color, vacant: !profile, profile })
      }
    }
    return result
  }, [profiles, stats, mode, maxUses])

  const selected = cells.find((c) => c.key === selectedKey)
  const selectedStats = selected?.profile ? stats.get(selected.profile.id) : undefined

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm shadow-slate-900/5">
        {(
          [
            ['pagos', 'Estado de pagos'],
            ['consumo', 'Uso de lavadora'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-xl py-2.5 text-sm font-bold transition ${mode === id ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {([null, ...[...FLOORS].reverse()] as Array<Floor | null>).map((f) => (
          <button
            key={f ?? 'todos'}
            type="button"
            onClick={() => {
              setOnlyFloor(f)
              setSelectedKey(null)
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              onlyFloor === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 shadow-sm shadow-slate-900/5'
            }`}
          >
            {f ? FLOOR_LABEL[f] : 'Edificio completo'}
          </button>
        ))}
      </div>

      <div className="relative h-[380px] overflow-hidden rounded-3xl bg-gradient-to-b from-sky-100 to-slate-100 shadow-sm shadow-slate-900/5">
        {loading ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">Cargando edificio…</p>
        ) : (
          <Building3D cells={cells} selectedKey={selectedKey} onlyFloor={onlyFloor} onSelect={setSelectedKey} />
        )}
        <p className="pointer-events-none absolute bottom-2 left-0 w-full text-center text-[11px] font-semibold text-slate-400">
          Arrastra para girar · pellizca para acercar · toca una habitación
        </p>
      </div>

      {mode === 'pagos' ? (
        <Legend
          items={[
            ['Al día', STATUS_COLOR.pagado],
            ['Por revisar', STATUS_COLOR.por_revisar],
            ['Pendiente', STATUS_COLOR.pendiente],
            ['Vencido', STATUS_COLOR.vencido],
            ['Sin cobro', NO_CHARGE_COLOR],
            ['Libre', VACANT_COLOR],
          ]}
        />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm shadow-slate-900/5">
            {(
              [
                ['month', 'Este mes'],
                ['3months', 'Últimos 3 meses'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setUsagePeriod(id)}
                className={`rounded-xl py-2 text-xs font-bold transition ${usagePeriod === id ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-500">
            <span>Menos uso</span>
            <span className="h-2.5 flex-1 rounded-full" style={{ background: 'linear-gradient(to right, #99f6e4, #115e59)' }} />
            <span>Más uso ({maxUses} {maxUses === 1 ? 'uso' : 'usos'})</span>
          </div>
        </div>
      )}

      {selected && (
        <div className="rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
          <p className="text-xs font-semibold text-slate-400">
            {FLOOR_LABEL[selected.floor]} · Hab. {selected.number}
          </p>
          {selected.profile && selectedStats ? (
            <>
              <p className="font-extrabold text-slate-800">
                {selected.profile.first_name} {selected.profile.last_name}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[11px] font-semibold text-slate-400">Pagos</p>
                  <p className="font-bold text-slate-700">
                    {selectedStats.status ? STATUS_LABEL[selectedStats.status] : 'Sin cobro'}
                    {selectedStats.debt > 0 && <span className="text-rose-600"> · debe {formatMoney(selectedStats.debt)}</span>}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[11px] font-semibold text-slate-400">Lavadora</p>
                  <p className="font-bold text-slate-700">
                    {selectedStats.uses} {selectedStats.uses === 1 ? 'uso' : 'usos'}
                    {selectedStats.minutes > 0 && ` · ${(selectedStats.minutes / 60).toFixed(1)} h`}
                  </p>
                </div>
              </div>
              <a href={`tel:${selected.profile.phone}`} className="mt-2 inline-block text-xs font-bold text-teal-700">
                Llamar · {selected.profile.phone}
              </a>
            </>
          ) : (
            <p className="font-bold text-slate-500">Habitación libre (sin inquilino registrado)</p>
          )}
        </div>
      )}
    </div>
  )
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-1">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span className="size-3 rounded" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  )
}
