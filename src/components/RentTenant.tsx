import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Landmark, Wallet } from 'lucide-react'
import { deletePayment, fetchPaymentInstructions, fetchRentData, requestDueDay, type RentData } from '@/lib/db'
import { formatDateEs, todayLocalISO } from '@/lib/dateUtils'
import { formatMoney, summarizeAll, type ChargeSummary } from '@/lib/rent'
import { classifyRentError } from '@/lib/errors'
import { ChargeCard } from './ChargeCard'
import { PaymentForm } from './PaymentForm'
import { Field, Sheet, inputClass } from './Sheet'
import { ToastView, useToast } from './Toast'

/** Pestaña "Pagos" del inquilino: qué debe, cómo pagar, y el historial. */
export function RentTenant({ userId }: { userId: string }) {
  const [data, setData] = useState<RentData | null>(null)
  const [instructions, setInstructions] = useState('')
  const [paying, setPaying] = useState<ChargeSummary | null>(null)
  const [pickingDay, setPickingDay] = useState(false)
  const [newDay, setNewDay] = useState('')
  const { toast, showToast, dismissToast } = useToast()

  const load = useCallback(() => {
    fetchRentData(userId).then(({ data }) => setData(data ?? { leases: [], charges: [], payments: [] }))
  }, [userId])

  useEffect(() => {
    load()
    fetchPaymentInstructions().then(({ data }) => setInstructions(data ?? ''))
  }, [load])

  const summaries = useMemo(
    () => (data ? summarizeAll(data.charges, data.leases, data.payments, todayLocalISO()) : []),
    [data],
  )
  const owed = summaries.reduce((s, c) => s + c.balance, 0)
  const overdue = summaries.filter((c) => c.status === 'vencido')
  const lease = data?.leases[0]

  async function submitDayRequest() {
    const { error } = await requestDueDay(Number(newDay))
    if (error) return showToast(classifyRentError(error), 'error')
    setPickingDay(false)
    showToast('Solicitud enviada. La dueña la revisará.', 'success')
    load()
  }

  async function cancelPending(paymentId: string) {
    await deletePayment(paymentId)
    load()
  }

  let headline = 'Saldo pendiente'
  if (!data) headline = 'Cargando…'
  else if (owed === 0) headline = summaries.length === 0 ? 'Aún no tienes cobros registrados.' : '¡Estás al día!'
  else if (overdue.length > 0) headline = `${overdue.length} ${overdue.length === 1 ? 'cobro vencido' : 'cobros vencidos'}`

  const tone =
    overdue.length > 0
      ? 'from-rose-600 to-rose-700 shadow-rose-900/20'
      : owed > 0
        ? 'from-amber-500 to-amber-600 shadow-amber-900/20'
        : 'from-emerald-600 to-emerald-700 shadow-emerald-900/20'

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div className={`rounded-3xl bg-gradient-to-br p-5 text-white shadow-lg ${tone}`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <Wallet className="size-4" strokeWidth={2.2} />
          Mis pagos
        </div>
        <p className="mt-1 text-3xl font-extrabold">{formatMoney(owed)}</p>
        <p className="text-sm text-white/85">{headline}</p>
        {lease && lease.active && (
          <p className="mt-2 text-xs text-white/75">
            Arriendo {formatMoney(lease.monthly_rent)} · vence el día {lease.due_day}
            {lease.late_fee_per_day > 0 && ` · multa ${formatMoney(lease.late_fee_per_day)}/día de atraso`}
          </p>
        )}
      </div>

      {lease && lease.active && (
        <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-teal-600" strokeWidth={2.2} />
            <p className="font-bold text-slate-800">Mi contrato</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2">
              <dt className="text-[11px] font-semibold text-slate-400">Ingreso</dt>
              <dd className="text-sm font-bold text-slate-700">{lease.move_in_date ? formatDateEs(lease.move_in_date) : '—'}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <dt className="text-[11px] font-semibold text-slate-400">Vence</dt>
              <dd className="text-sm font-bold text-slate-700">{lease.contract_end ? formatDateEs(lease.contract_end) : '—'}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <dt className="text-[11px] font-semibold text-slate-400">Día de pago</dt>
              <dd className="text-sm font-bold text-slate-700">{lease.due_day}</dd>
            </div>
          </dl>
          {lease.requested_due_day ? (
            <p className="rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-700">
              Pediste pagar el día {lease.requested_due_day}. Esperando la respuesta de la dueña.
            </p>
          ) : (
            <button type="button" onClick={() => setPickingDay(true)} className="text-xs font-bold text-teal-700">
              Pedir otro día de pago
            </button>
          )}
        </div>
      )}

      {instructions && (
        <div className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-slate-900/5">
          <Landmark className="mt-0.5 size-5 shrink-0 text-teal-600" strokeWidth={2.2} />
          <div>
            <p className="text-xs font-bold text-slate-400">Datos para transferir</p>
            <p className="text-sm whitespace-pre-line text-slate-700">{instructions}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data && summaries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-400">
            Cuando la dueña genere tus cobros aparecerán aquí.
          </div>
        )}
        {summaries.map((s) => (
          <ChargeCard
            key={s.charge.id}
            summary={s}
            actions={
              s.balance > 0 && (
                <button
                  type="button"
                  onClick={() => setPaying(s)}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
                >
                  Reportar pago
                </button>
              )
            }
            paymentActions={(p) =>
              p.status === 'pendiente' && (
                <button type="button" onClick={() => cancelPending(p.id)} className="ml-auto font-bold text-slate-400">
                  Cancelar
                </button>
              )
            }
          />
        ))}
      </div>

      {paying && (
        <PaymentForm
          summary={paying}
          asOwner={false}
          onClose={() => setPaying(null)}
          onError={(m) => showToast(m, 'error')}
          onDone={(m) => {
            setPaying(null)
            showToast(m, 'success')
            load()
          }}
        />
      )}

      {pickingDay && lease && (
        <Sheet title="Pedir otro día de pago" onClose={() => setPickingDay(false)}>
          <Field label="¿Qué día del mes prefieres pagar? (1-28)">
            <input type="number" inputMode="numeric" min="1" max="28" value={newDay} onChange={(e) => setNewDay(e.target.value)} className={inputClass} />
          </Field>
          <p className="text-xs text-slate-400">Hoy pagas el día {lease.due_day}. La dueña debe aprobarlo y aplica desde el próximo cobro.</p>
          <button
            type="button"
            disabled={!(Number(newDay) >= 1 && Number(newDay) <= 28) || Number(newDay) === lease.due_day}
            onClick={submitDayRequest}
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Enviar solicitud
          </button>
        </Sheet>
      )}

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
