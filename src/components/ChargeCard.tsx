import type { ReactNode } from 'react'
import { Paperclip } from 'lucide-react'
import { formatDateEs } from '@/lib/dateUtils'
import { getReceiptUrl } from '@/lib/db'
import { KIND_LABEL, STATUS_LABEL, STATUS_STYLE, formatMoney, type ChargeSummary } from '@/lib/rent'
import type { Payment, PaymentStatus } from '@/lib/types'

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  pendiente: 'text-sky-600',
  aprobado: 'text-emerald-600',
  rechazado: 'text-rose-600',
}
const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendiente: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

export async function openReceipt(path: string) {
  const url = await getReceiptUrl(path)
  if (url) window.open(url, '_blank', 'noopener')
}

interface ChargeCardProps {
  summary: ChargeSummary
  /** Botones debajo del cobro (pagar, recordar…). */
  actions?: ReactNode
  /** Acciones por pago (aprobar / rechazar / borrar). */
  paymentActions?: (payment: Payment) => ReactNode
}

export function ChargeCard({ summary, actions, paymentActions }: ChargeCardProps) {
  const { charge, status } = summary

  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm shadow-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-800">{charge.concept}</p>
          <p className="text-xs text-slate-400">
            {KIND_LABEL[charge.kind]} · vence {formatDateEs(charge.due_date)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-extrabold text-slate-900">{formatMoney(summary.total)}</p>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {(summary.lateFee > 0 || summary.paid > 0) && (
        <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
          {summary.lateFee > 0 && (
            <p className="flex justify-between text-rose-600">
              <span>
                Multa por atraso ({summary.lateDays} {summary.lateDays === 1 ? 'día' : 'días'})
              </span>
              <span className="font-bold">+{formatMoney(summary.lateFee)}</span>
            </p>
          )}
          {summary.paid > 0 && (
            <p className="flex justify-between">
              <span>Pagado</span>
              <span className="font-bold text-emerald-600">−{formatMoney(summary.paid)}</span>
            </p>
          )}
          {summary.balance > 0 && (
            <p className="flex justify-between text-slate-700">
              <span className="font-semibold">Saldo</span>
              <span className="font-extrabold">{formatMoney(summary.balance)}</span>
            </p>
          )}
        </div>
      )}

      {summary.payments.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
          {summary.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-bold text-slate-700">{formatMoney(p.amount)}</span>
              <span className="text-slate-400">
                {p.method === 'efectivo' ? 'Efectivo' : 'Transferencia'} · {formatDateEs(p.paid_on)}
              </span>
              <span className={`font-bold ${PAYMENT_STATUS_STYLE[p.status]}`}>{PAYMENT_STATUS_LABEL[p.status]}</span>
              {p.receipt_path && (
                <button
                  type="button"
                  onClick={() => openReceipt(p.receipt_path!)}
                  className="flex items-center gap-0.5 font-bold text-teal-700"
                >
                  <Paperclip className="size-3" strokeWidth={2.4} />
                  Comprobante
                </button>
              )}
              {p.status === 'rechazado' && p.review_note && <span className="w-full text-rose-500">Motivo: {p.review_note}</span>}
              {paymentActions?.(p)}
            </li>
          ))}
        </ul>
      )}

      {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
