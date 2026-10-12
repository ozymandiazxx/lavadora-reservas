import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BellRing, ChevronDown, ChevronLeft, ChevronRight, Droplets, Landmark, Paperclip, Plus, Settings2 } from 'lucide-react'
import {
  addLaundryCharges,
  createCharges,
  deleteCharge,
  deletePayment,
  fetchAllProfiles,
  fetchPaymentInstructions,
  fetchRentData,
  remindTenant,
  reviewPayment,
  runRentJob,
  savePaymentInstructions,
  upsertLease,
  type RentData,
} from '@/lib/db'
import { addDaysLocal, formatDateEs, todayLocalISO } from '@/lib/dateUtils'
import { classifyRentError } from '@/lib/errors'
import {
  STATUS_LABEL,
  STATUS_STYLE,
  formatMoney,
  periodLabel,
  periodOf,
  shiftPeriod,
  summarizeAll,
  type ChargeStatus,
  type ChargeSummary,
} from '@/lib/rent'
import { FLOOR_LABEL } from '@/lib/rooms'
import type { ChargeKind, Lease, Payment, PaymentStatus, Profile } from '@/lib/types'
import { ChargeCard, openReceipt } from './ChargeCard'
import { PaymentForm } from './PaymentForm'
import { Field, Sheet, inputClass } from './Sheet'
import { ToastView, useToast } from './Toast'

type Filter = 'todos' | 'deuda'
type Dialog =
  | { type: 'pay'; summary: ChargeSummary }
  | { type: 'lease'; profile: Profile }
  | { type: 'charge'; tenantId: string }
  | { type: 'laundry' }
  | { type: 'instructions' }
  | { type: 'reject'; payment: Payment }

const STATUS_RANK: Record<ChargeStatus, number> = { vencido: 0, por_revisar: 1, pendiente: 2, pagado: 3 }

function initialsOf(p: Profile): string {
  return `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase()
}

export function RentOwner() {
  const today = todayLocalISO()
  const [period, setPeriod] = useState(periodOf(today))
  const [data, setData] = useState<RentData | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [instructions, setInstructions] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const { toast, showToast, dismissToast } = useToast()

  const load = useCallback(async () => {
    const [rent, people] = await Promise.all([fetchRentData(null), fetchAllProfiles()])
    if (rent.error) showToast(classifyRentError(rent.error), 'error')
    setData(rent.data ?? { leases: [], charges: [], payments: [] })
    setProfiles((people.data ?? []).filter((p) => !p.is_owner))
  }, [showToast])

  useEffect(() => {
    // Genera el arriendo del mes y los recordatorios pendientes antes de mostrar los datos.
    runRentJob().then(load)
    fetchPaymentInstructions().then(({ data }) => setInstructions(data ?? ''))
  }, [load])

  const summaries = useMemo(
    () => (data ? summarizeAll(data.charges, data.leases, data.payments, today) : []),
    [data, today],
  )
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const periodSummaries = summaries.filter((s) => s.charge.period === period)

  const collected = periodSummaries.reduce((sum, s) => sum + s.paid, 0)
  const toCollect = periodSummaries.reduce((sum, s) => sum + s.balance, 0)
  const overdueCount = periodSummaries.filter((s) => s.status === 'vencido').length
  const pendingPayments = (data?.payments ?? []).filter((p) => p.status === 'pendiente')

  const rows = useMemo(() => {
    const leaseByTenant = new Map((data?.leases ?? []).map((l) => [l.tenant_id, l]))
    return profiles
      .map((profile) => {
        const mine = summaries.filter((s) => s.charge.tenant_id === profile.id)
        const thisPeriod = mine.filter((s) => s.charge.period === period)
        const debt = mine.reduce((sum, s) => sum + s.balance, 0)
        const worst = thisPeriod.reduce<ChargeStatus | null>(
          (w, s) => (w === null || STATUS_RANK[s.status] < STATUS_RANK[w] ? s.status : w),
          null,
        )
        const olderOverdue = mine.some((s) => s.charge.period < period && s.balance > 0)
        return { profile, lease: leaseByTenant.get(profile.id), mine, thisPeriod, debt, status: olderOverdue && worst !== 'vencido' ? ('vencido' as const) : worst }
      })
      .filter((r) => filter === 'todos' || r.debt > 0)
  }, [profiles, summaries, data, period, filter])

  async function run(action: Promise<{ error: { code: string; message: string } | null }>, okMessage?: string) {
    const { error } = await action
    if (error) {
      showToast(classifyRentError({ ...error }), 'error')
      return false
    }
    if (okMessage) showToast(okMessage, 'success')
    await load()
    return true
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm shadow-slate-900/5">
        <button type="button" onClick={() => setPeriod(shiftPeriod(period, -1))} className="rounded-xl p-2 text-slate-500" aria-label="Mes anterior">
          <ChevronLeft className="size-5" strokeWidth={2.2} />
        </button>
        <p className="font-extrabold text-slate-800 capitalize">{periodLabel(period)}</p>
        <button type="button" onClick={() => setPeriod(shiftPeriod(period, 1))} className="rounded-xl p-2 text-slate-500" aria-label="Mes siguiente">
          <ChevronRight className="size-5" strokeWidth={2.2} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Cobrado" value={formatMoney(collected)} tone="text-emerald-600" />
        <Tile label="Por cobrar" value={formatMoney(toCollect)} tone="text-amber-600" />
        <Tile label="Vencidos" value={String(overdueCount)} tone={overdueCount > 0 ? 'text-rose-600' : 'text-slate-800'} />
      </div>

      {pendingPayments.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <p className="text-sm font-extrabold text-sky-800">Pagos por revisar ({pendingPayments.length})</p>
          {pendingPayments.map((p) => {
            const who = profileById.get(p.tenant_id)
            const charge = data?.charges.find((c) => c.id === p.charge_id)
            return (
              <div key={p.id} className="rounded-xl bg-white p-3 text-sm shadow-sm shadow-slate-900/5">
                <p className="font-bold text-slate-800">
                  {who ? `${who.first_name} ${who.last_name} · Hab. ${who.room_number}` : 'Inquilino'}
                </p>
                <p className="text-xs text-slate-500">
                  {formatMoney(p.amount)} · {p.method === 'efectivo' ? 'Efectivo' : 'Transferencia'} · {formatDateEs(p.paid_on)} ·{' '}
                  {charge?.concept}
                </p>
                {p.note && <p className="text-xs text-slate-400">“{p.note}”</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p.receipt_path && (
                    <button
                      type="button"
                      onClick={() => openReceipt(p.receipt_path!)}
                      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600"
                    >
                      <Paperclip className="size-3" strokeWidth={2.4} />
                      Ver comprobante
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => run(reviewPayment(p.id, 'aprobado', null), 'Pago aprobado.')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ type: 'reject', payment: p })}
                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <ToolButton icon={Plus} label="Nuevo cargo" onClick={() => setDialog({ type: 'charge', tenantId: 'todos' })} />
        <ToolButton icon={Droplets} label="Cobrar lavadora" onClick={() => setDialog({ type: 'laundry' })} />
        <ToolButton icon={Landmark} label="Datos de pago" onClick={() => setDialog({ type: 'instructions' })} />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm shadow-slate-900/5">
        {(['todos', 'deuda'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-xl py-2 text-xs font-bold transition ${filter === f ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            {f === 'todos' ? 'Todos los inquilinos' : 'Con deuda'}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="text-center text-sm text-slate-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
          {filter === 'deuda' ? 'Nadie tiene deuda. 🎉' : 'No hay inquilinos registrados.'}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ profile, lease, mine, thisPeriod, debt, status }) => {
            const open = expanded === profile.id
            const older = mine.filter((s) => s.charge.period !== period && s.balance > 0)
            return (
              <div key={profile.id} className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-900/5">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : profile.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-extrabold text-teal-700">
                    {initialsOf(profile)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800">
                      {profile.first_name} {profile.last_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {FLOOR_LABEL[profile.floor]} · Hab. {profile.room_number}
                      {lease?.active ? ` · ${formatMoney(lease.monthly_rent)}/mes` : ' · sin contrato'}
                    </p>
                  </div>
                  <div className="text-right">
                    {status ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-400">Sin cobro</span>
                    )}
                    {debt > 0 && <p className="mt-0.5 text-xs font-extrabold text-slate-700">Debe {formatMoney(debt)}</p>}
                  </div>
                  <ChevronDown className={`size-4 shrink-0 text-slate-300 transition ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
                </button>

                {open && (
                  <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-3">
                    {thisPeriod.length === 0 && (
                      <p className="px-1 text-xs text-slate-400">Sin cobros en {periodLabel(period)}.</p>
                    )}
                    {[...older, ...thisPeriod].map((s) => (
                      <ChargeCard
                        key={s.charge.id}
                        summary={s}
                        actions={
                          <>
                            {s.balance > 0 && (
                              <button
                                type="button"
                                onClick={() => setDialog({ type: 'pay', summary: s })}
                                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white"
                              >
                                Registrar pago
                              </button>
                            )}
                            {s.balance > 0 && (
                              <button
                                type="button"
                                onClick={() => run(remindTenant(s.charge.id), 'Recordatorio enviado.')}
                                className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"
                              >
                                <BellRing className="size-3" strokeWidth={2.4} />
                                Recordar
                              </button>
                            )}
                            {s.payments.length === 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('¿Eliminar este cobro?')) run(deleteCharge(s.charge.id), 'Cobro eliminado.')
                                }}
                                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500"
                              >
                                Eliminar
                              </button>
                            )}
                          </>
                        }
                        paymentActions={(p) =>
                          p.status === 'pendiente' ? (
                            <span className="ml-auto flex gap-2">
                              <button type="button" onClick={() => run(reviewPayment(p.id, 'aprobado', null))} className="font-bold text-emerald-600">
                                Aprobar
                              </button>
                              <button type="button" onClick={() => setDialog({ type: 'reject', payment: p })} className="font-bold text-rose-600">
                                Rechazar
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('¿Eliminar este pago?')) run(deletePayment(p.id))
                              }}
                              className="ml-auto font-bold text-slate-400"
                            >
                              Eliminar
                            </button>
                          )
                        }
                      />
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDialog({ type: 'lease', profile })}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-bold text-slate-600 shadow-sm"
                      >
                        <Settings2 className="size-3.5" strokeWidth={2.2} />
                        Condiciones
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ type: 'charge', tenantId: profile.id })}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-bold text-slate-600 shadow-sm"
                      >
                        <Plus className="size-3.5" strokeWidth={2.2} />
                        Agregar cargo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {dialog?.type === 'pay' && (
        <PaymentForm
          summary={dialog.summary}
          asOwner
          onClose={() => setDialog(null)}
          onError={(m) => showToast(m, 'error')}
          onDone={(m) => {
            setDialog(null)
            showToast(m, 'success')
            load()
          }}
        />
      )}

      {dialog?.type === 'lease' && (
        <LeaseSheet
          profile={dialog.profile}
          lease={data?.leases.find((l) => l.tenant_id === dialog.profile.id)}
          onClose={() => setDialog(null)}
          onSave={async (lease) => {
            const saved = await run(upsertLease(lease), 'Condiciones guardadas.')
            if (saved) {
              setDialog(null)
              await run(runRentJob())
            }
          }}
        />
      )}

      {dialog?.type === 'charge' && (
        <ChargeSheet
          profiles={profiles}
          leases={data?.leases ?? []}
          initialTenant={dialog.tenantId}
          period={period}
          onClose={() => setDialog(null)}
          onSave={async (list) => {
            if (await run(createCharges(list), list.length > 1 ? `${list.length} cargos creados.` : 'Cargo creado.')) setDialog(null)
          }}
        />
      )}

      {dialog?.type === 'laundry' && (
        <LaundrySheet
          period={period}
          onClose={() => setDialog(null)}
          onSave={async (price) => {
            const { data: count, error } = await addLaundryCharges(period, price)
            if (error) return showToast(classifyRentError(error), 'error')
            setDialog(null)
            showToast(count ? `Cobro de lavadora generado para ${count} inquilinos.` : 'Nadie usó la lavadora ese mes.', count ? 'success' : 'info')
            load()
          }}
        />
      )}

      {dialog?.type === 'instructions' && (
        <InstructionsSheet
          initial={instructions}
          onClose={() => setDialog(null)}
          onSave={async (text) => {
            if (await run(savePaymentInstructions(text), 'Datos guardados.')) {
              setInstructions(text)
              setDialog(null)
            }
          }}
        />
      )}

      {dialog?.type === 'reject' && (
        <RejectSheet
          onClose={() => setDialog(null)}
          onSave={async (note) => {
            const status: PaymentStatus = 'rechazado'
            if (await run(reviewPayment(dialog.payment.id, status, note || null), 'Pago rechazado.')) setDialog(null)
          }}
        />
      )}

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-900/5">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className={`text-lg font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}

function ToolButton({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl bg-white px-2 py-3 text-[11px] font-bold text-slate-600 shadow-sm shadow-slate-900/5 transition active:scale-[0.98]"
    >
      <Icon className="size-5 text-teal-600" strokeWidth={2.2} />
      {label}
    </button>
  )
}

function SubmitButton({ children, disabled }: { children: string; disabled?: boolean }) {
  return (
    <button type="submit" disabled={disabled} className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white disabled:opacity-50">
      {children}
    </button>
  )
}

function LeaseSheet({
  profile,
  lease,
  onClose,
  onSave,
}: {
  profile: Profile
  lease: Lease | undefined
  onClose: () => void
  onSave: (lease: Lease) => Promise<void>
}) {
  const [rent, setRent] = useState(lease ? String(lease.monthly_rent) : '')
  const [dueDay, setDueDay] = useState(String(lease?.due_day ?? 5))
  const [lateFee, setLateFee] = useState(String(lease?.late_fee_per_day ?? 0))
  const [active, setActive] = useState(lease?.active ?? true)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      tenant_id: profile.id,
      monthly_rent: Number(rent),
      due_day: Number(dueDay),
      late_fee_per_day: Number(lateFee) || 0,
      active,
    })
    setSaving(false)
  }

  return (
    <Sheet title={`Arriendo · ${profile.first_name} ${profile.last_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Arriendo mensual (USD)">
          <input type="number" inputMode="decimal" step="0.01" min="0" required value={rent} onChange={(e) => setRent(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Día del mes en que vence (1-28)">
          <input type="number" inputMode="numeric" min="1" max="28" required value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Multa por cada día de atraso (USD, 0 = sin multa)">
          <input type="number" inputMode="decimal" step="0.01" min="0" value={lateFee} onChange={(e) => setLateFee(e.target.value)} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-teal-600" />
          Contrato activo (genera cobro mensual)
        </label>
        <SubmitButton disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</SubmitButton>
      </form>
    </Sheet>
  )
}

function ChargeSheet({
  profiles,
  leases,
  initialTenant,
  period,
  onClose,
  onSave,
}: {
  profiles: Profile[]
  leases: Lease[]
  initialTenant: string
  period: string
  onClose: () => void
  onSave: (list: Parameters<typeof createCharges>[0]) => Promise<void>
}) {
  const [tenantId, setTenantId] = useState(initialTenant)
  const [kind, setKind] = useState<Extract<ChargeKind, 'servicio' | 'otro'>>('servicio')
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(addDaysLocal(todayLocalISO(), 7))
  const [saving, setSaving] = useState(false)

  const activeTenants = new Set(leases.filter((l) => l.active).map((l) => l.tenant_id))
  const targets = tenantId === 'todos' ? profiles.filter((p) => activeTenants.has(p.id)) : profiles.filter((p) => p.id === tenantId)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(
      targets.map((p) => ({
        tenant_id: p.id,
        period,
        kind,
        concept: concept.trim(),
        amount: Math.round(Number(amount) * 100) / 100,
        due_date: dueDate,
      })),
    )
    setSaving(false)
  }

  return (
    <Sheet title="Nuevo cargo" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Para">
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className={inputClass}>
            <option value="todos">Todos los inquilinos con contrato activo</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name} · Hab. {p.room_number} ({FLOOR_LABEL[p.floor]})
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['servicio', 'Luz / agua'],
              ['otro', 'Otro'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={`rounded-xl py-2.5 text-sm font-bold transition ${kind === id ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Concepto">
          <input
            type="text"
            required
            maxLength={80}
            placeholder={kind === 'servicio' ? 'Ej: Luz octubre' : 'Ej: Reposición de llave'}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={tenantId === 'todos' ? 'Monto por inquilino (USD)' : 'Monto (USD)'}>
          <input type="number" inputMode="decimal" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Vence el">
          <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </Field>
        <p className="text-xs text-slate-400">
          Se crea {targets.length === 1 ? '1 cargo' : `${targets.length} cargos`} en {periodLabel(period)} y se avisa a cada inquilino.
        </p>
        <SubmitButton disabled={saving || targets.length === 0}>{saving ? 'Creando…' : 'Crear cargo'}</SubmitButton>
      </form>
    </Sheet>
  )
}

function LaundrySheet({ period, onClose, onSave }: { period: string; onClose: () => void; onSave: (price: number) => Promise<void> }) {
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(Number(price))
    setSaving(false)
  }

  return (
    <Sheet title="Cobrar lavadora" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-500">
          Genera un cobro a cada inquilino según cuántas veces usó la lavadora en <b className="capitalize">{periodLabel(period)}</b>. Si
          lo vuelves a generar, se recalcula (salvo que ya tenga pagos aprobados).
        </p>
        <Field label="Precio por uso (USD)">
          <input type="number" inputMode="decimal" step="0.01" min="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </Field>
        <SubmitButton disabled={saving}>{saving ? 'Generando…' : 'Generar cobros'}</SubmitButton>
      </form>
    </Sheet>
  )
}

function InstructionsSheet({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(text.trim())
    setSaving(false)
  }

  return (
    <Sheet title="Datos para transferir" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-500">Los inquilinos ven este texto en su pestaña Pagos.</p>
        <textarea
          rows={4}
          maxLength={400}
          placeholder={'Banco, tipo y número de cuenta, titular, cédula…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={inputClass}
        />
        <SubmitButton disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</SubmitButton>
      </form>
    </Sheet>
  )
}

function RejectSheet({ onClose, onSave }: { onClose: () => void; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(note.trim())
    setSaving(false)
  }

  return (
    <Sheet title="Rechazar pago" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Motivo (se le muestra al inquilino)">
          <input type="text" maxLength={200} placeholder="Ej: no veo la transferencia en el banco" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? 'Guardando…' : 'Rechazar pago'}
        </button>
      </form>
    </Sheet>
  )
}
