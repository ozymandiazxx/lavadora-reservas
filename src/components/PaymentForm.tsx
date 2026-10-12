import { useState, type FormEvent } from 'react'
import { Banknote, Landmark } from 'lucide-react'
import { createPayment } from '@/lib/db'
import { todayLocalISO } from '@/lib/dateUtils'
import { classifyRentError } from '@/lib/errors'
import { formatMoney, type ChargeSummary } from '@/lib/rent'
import type { PaymentMethod } from '@/lib/types'
import { Field, Sheet, inputClass } from './Sheet'

interface PaymentFormProps {
  summary: ChargeSummary
  /** La dueña registra el pago directo (queda aprobado); el inquilino lo reporta y espera revisión. */
  asOwner: boolean
  onClose: () => void
  onDone: (message: string) => void
  onError: (message: string) => void
}

export function PaymentForm({ summary, asOwner, onClose, onDone, onError }: PaymentFormProps) {
  const { charge } = summary
  const [amount, setAmount] = useState(summary.balance.toFixed(2))
  const [method, setMethod] = useState<PaymentMethod>(asOwner ? 'efectivo' : 'transferencia')
  const [paidOn, setPaidOn] = useState(todayLocalISO())
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const value = Number(amount)
  const invalid = !(value > 0) || value > summary.balance + 0.001

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setSaving(true)
    const { error } = await createPayment(
      {
        charge_id: charge.id,
        tenant_id: charge.tenant_id,
        amount: Math.round(value * 100) / 100,
        method,
        paid_on: paidOn,
        note: note.trim() || null,
        receipt: asOwner ? null : receipt,
      },
      asOwner,
    )
    setSaving(false)
    if (error) return onError(classifyRentError(error))
    onDone(asOwner ? 'Pago registrado.' : 'Pago enviado. La dueña lo revisará pronto.')
  }

  return (
    <Sheet title={asOwner ? 'Registrar pago' : 'Reportar pago'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-bold text-slate-800">{charge.concept}</span> · Saldo {formatMoney(summary.balance)}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['transferencia', 'Transferencia', Landmark],
              ['efectivo', 'Efectivo', Banknote],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition ${
                method === id ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Icon className="size-4" strokeWidth={2.2} />
              {label}
            </button>
          ))}
        </div>

        <Field label="Monto (USD)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={summary.balance}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Fecha del pago">
          <input type="date" required max={todayLocalISO()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
        </Field>

        {!asOwner && method === 'transferencia' && (
          <Field label="Comprobante (foto o PDF)">
            <input
              type="file"
              accept="image/*,application/pdf"
              required
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-bold file:text-teal-700"
            />
          </Field>
        )}

        <Field label="Nota (opcional)">
          <input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>

        {value > summary.balance + 0.001 && <p className="text-xs font-semibold text-red-600">El monto supera el saldo pendiente.</p>}

        <button
          type="submit"
          disabled={saving || invalid}
          className="w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Guardando…' : asOwner ? 'Registrar pago' : 'Enviar pago'}
        </button>
      </form>
    </Sheet>
  )
}
