import type { Charge, ChargeKind, Lease, Payment } from './types'

export type ChargeStatus = 'pagado' | 'por_revisar' | 'vencido' | 'pendiente'

export interface ChargeSummary {
  charge: Charge
  payments: Payment[]
  lateDays: number
  lateFee: number
  /** Monto original + multa. */
  total: number
  /** Pagos aprobados. */
  paid: number
  /** Pagos reportados que la dueña aún no revisó. */
  underReview: number
  /** Lo que falta por pagar (total − aprobado). */
  balance: number
  status: ChargeStatus
}

export const KIND_LABEL: Record<ChargeKind, string> = {
  arriendo: 'Arriendo',
  lavadora: 'Lavadora',
  servicio: 'Luz / agua',
  otro: 'Otro',
}

export const STATUS_LABEL: Record<ChargeStatus, string> = {
  pagado: 'Pagado',
  por_revisar: 'Por revisar',
  vencido: 'Vencido',
  pendiente: 'Pendiente',
}

export const STATUS_STYLE: Record<ChargeStatus, string> = {
  pagado: 'bg-emerald-100 text-emerald-700',
  por_revisar: 'bg-sky-100 text-sky-700',
  vencido: 'bg-rose-100 text-rose-700',
  pendiente: 'bg-amber-100 text-amber-700',
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const moneyFormat = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })

export function formatMoney(value: number): string {
  return moneyFormat.format(value)
}

/** "2026-10-01" → "octubre 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function periodOf(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m - 1 + months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Multa por atraso: solo el arriendo, días de atraso × tarifa diaria. Corre mientras
 * quede saldo del monto original; al saldarlo se congela en la fecha del último pago aprobado.
 */
export function summarizeCharge(charge: Charge, lease: Lease | undefined, allPayments: Payment[], today: string): ChargeSummary {
  const payments = allPayments.filter((p) => p.charge_id === charge.id)
  const approved = payments.filter((p) => p.status === 'aprobado')
  const paid = round2(approved.reduce((s, p) => s + p.amount, 0))
  const underReview = round2(payments.filter((p) => p.status === 'pendiente').reduce((s, p) => s + p.amount, 0))

  const principalSettled = paid >= charge.amount
  const lastPaidOn = approved.reduce((max, p) => (p.paid_on > max ? p.paid_on : max), '')
  const lateUntil = principalSettled ? lastPaidOn : today
  const rate = charge.kind === 'arriendo' ? (lease?.late_fee_per_day ?? 0) : 0
  const lateDays = rate > 0 ? Math.max(0, daysBetween(charge.due_date, lateUntil)) : 0
  const lateFee = round2(lateDays * rate)

  const total = round2(charge.amount + lateFee)
  const balance = round2(Math.max(0, total - paid))

  let status: ChargeStatus
  if (balance === 0) status = 'pagado'
  else if (underReview > 0) status = 'por_revisar'
  else if (today > charge.due_date) status = 'vencido'
  else status = 'pendiente'

  return { charge, payments, lateDays, lateFee, total, paid, underReview, balance, status }
}

export function summarizeAll(charges: Charge[], leases: Lease[], payments: Payment[], today: string): ChargeSummary[] {
  const leaseByTenant = new Map(leases.map((l) => [l.tenant_id, l]))
  return charges.map((c) => summarizeCharge(c, leaseByTenant.get(c.tenant_id), payments, today))
}
