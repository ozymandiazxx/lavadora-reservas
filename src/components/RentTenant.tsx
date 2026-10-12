import { useCallback, useEffect, useMemo, useState } from 'react'
import { Landmark, Wallet } from 'lucide-react'
import { deletePayment, fetchPaymentInstructions, fetchRentData, type RentData } from '@/lib/db'
import { todayLocalISO } from '@/lib/dateUtils'
import { formatMoney, summarizeAll, type ChargeSummary } from '@/lib/rent'
import { ChargeCard } from './ChargeCard'
import { PaymentForm } from './PaymentForm'
import { ToastView, useToast } from './Toast'

/** Pestaña "Pagos" del inquilino: qué debe, cómo pagar, y el historial. */
export function RentTenant({ userId }: { userId: string }) {
  const [data, setData] = useState<RentData | null>(null)
  const [instructions, setInstructions] = useState('')
  const [paying, setPaying] = useState<ChargeSummary | null>(null)
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

      <ToastView toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
