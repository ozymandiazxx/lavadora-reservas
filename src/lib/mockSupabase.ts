import type {
  Announcement,
  AppNotification,
  MaintenanceCategory,
  MaintenanceRequest,
  MaintenanceStatus,
  Charge,
  Lease,
  NewCharge,
  Payment,
  PaymentStatus,
  LostFoundReport,
  LostFoundType,
  OccupiedRange,
  Profile,
  Reservation,
  ReservationWithDetails,
} from './types'
import {
  dateOf,
  formatShortDateTime,
  isoWeekKey,
  nowLocalDateTime,
  rangesOverlap,
  reservationEnd,
  todayLocalISO,
  combineDateAndTime,
} from './dateUtils'
import { periodOf, shiftPeriod } from './rent'

const OWNER_RECIPIENT = 'owner'

interface DemoNotification extends AppNotification {
  recipientId: string
}

export const DEMO_TENANT_ID = 'demo-tenant-0000-0000-000000000000'

const DEMO_PROFILE: Profile = {
  id: DEMO_TENANT_ID,
  first_name: 'Vecina',
  last_name: 'Demo',
  room_number: '205',
  room_type: 'normal',
  floor: 'piso_2',
  phone: '11-5555-0100',
  is_owner: false,
}

const NEIGHBOR_PROFILES: Record<
  string,
  Pick<Profile, 'first_name' | 'last_name' | 'room_number' | 'room_type' | 'floor' | 'phone'>
> = {
  'neighbor-1': {
    first_name: 'Marta',
    last_name: 'Gómez',
    room_number: '308',
    room_type: 'normal',
    floor: 'piso_3',
    phone: '11-5555-0101',
  },
  'neighbor-2': {
    first_name: 'Luis',
    last_name: 'Pérez',
    room_number: 'S2',
    room_type: 'suite',
    floor: 'subsuelo',
    phone: '11-5555-0102',
  },
  'neighbor-3': {
    first_name: 'Ana',
    last_name: 'Rodríguez',
    room_number: 'T1',
    room_type: 'suite',
    floor: 'terraza',
    phone: '11-5555-0103',
  },
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${dd}`
}

function seedReservations(): Reservation[] {
  const today = todayLocalISO()
  const seeds: Array<{ id: string; tenant_id: string; date: string; time: string; machine: number }> = [
    { id: 'seed-1', tenant_id: 'neighbor-1', date: today, time: '17:30', machine: 1 },
    { id: 'seed-2', tenant_id: 'neighbor-2', date: addDays(today, 1), time: '10:30', machine: 2 },
    { id: 'seed-3', tenant_id: 'neighbor-3', date: addDays(today, 2), time: '23:30', machine: 1 },
  ]
  return seeds.map((s) => {
    const starts_at = combineDateAndTime(s.date, s.time)
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      starts_at,
      ends_at: reservationEnd(starts_at),
      machine: s.machine,
      created_at: new Date().toISOString(),
    }
  })
}

function seedLostFound(): LostFoundReport[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'lf-seed-1',
      reporter_id: 'neighbor-1',
      report_type: 'encontrado',
      description: 'Toalla celeste con rayas blancas',
      location: 'En el tendedero del fondo',
      photo_url: null,
      resolved: false,
      created_at: now,
      ...NEIGHBOR_PROFILES['neighbor-1'],
    },
    {
      id: 'lf-seed-2',
      reporter_id: 'neighbor-3',
      report_type: 'perdido',
      description: 'Par de medias negras con detalle blanco',
      location: null,
      photo_url: null,
      resolved: false,
      created_at: now,
      ...NEIGHBOR_PROFILES['neighbor-3'],
    },
  ]
}

function seedRent(): { leases: Lease[]; charges: Charge[]; payments: Payment[] } {
  const thisMonth = periodOf(todayLocalISO())
  const lastMonth = shiftPeriod(thisMonth, -1)
  const lease = (tenant_id: string, monthly_rent: number, due_day: number, late_fee_per_day: number): Lease => ({
    tenant_id,
    monthly_rent,
    due_day,
    late_fee_per_day,
    active: true,
  })
  const rentCharge = (id: string, tenant_id: string, period: string, amount: number, dueDay: number): Charge => ({
    id,
    tenant_id,
    period,
    kind: 'arriendo',
    concept: `Arriendo ${period.slice(5, 7)}/${period.slice(0, 4)}`,
    amount,
    due_date: `${period.slice(0, 8)}${String(dueDay).padStart(2, '0')}`,
    created_at: new Date().toISOString(),
  })
  const pay = (id: string, charge_id: string, tenant_id: string, amount: number, paid_on: string, status: PaymentStatus): Payment => ({
    id,
    charge_id,
    tenant_id,
    amount,
    method: 'transferencia',
    paid_on,
    receipt_path: null,
    note: null,
    status,
    review_note: null,
    created_at: new Date().toISOString(),
  })
  return {
    leases: [lease(DEMO_TENANT_ID, 120, 5, 2), lease('neighbor-1', 150, 5, 2), lease('neighbor-2', 200, 1, 3)],
    charges: [
      rentCharge('c-demo-prev', DEMO_TENANT_ID, lastMonth, 120, 5),
      rentCharge('c-demo-now', DEMO_TENANT_ID, thisMonth, 120, 5),
      rentCharge('c-n1-now', 'neighbor-1', thisMonth, 150, 5),
      rentCharge('c-n2-now', 'neighbor-2', thisMonth, 200, 1),
    ],
    payments: [
      pay('p-demo-prev', 'c-demo-prev', DEMO_TENANT_ID, 120, `${lastMonth.slice(0, 8)}04`, 'aprobado'),
      pay('p-n1-now', 'c-n1-now', 'neighbor-1', 150, `${thisMonth.slice(0, 8)}03`, 'aprobado'),
      pay('p-n2-now', 'c-n2-now', 'neighbor-2', 200, todayLocalISO(), 'pendiente'),
    ],
  }
}

const seededRent = seedRent()
let leases: Lease[] = seededRent.leases
let charges: Charge[] = seededRent.charges
let payments: Payment[] = seededRent.payments
let paymentInstructions = 'Banco Pichincha · Cuenta de ahorros 1234567890 · A nombre de la propietaria'

let maintenance: MaintenanceRequest[] = [
  {
    id: 'm-seed-1',
    tenant_id: 'neighbor-1',
    category: 'agua',
    description: 'La llave del lavamanos del piso 3 gotea todo el día.',
    photo_path: null,
    status: 'pendiente',
    response: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  },
]
let announcements: Announcement[] = [
  {
    id: 'a-seed-1',
    title: 'Corte de agua programado',
    body: 'El sábado de 9:00 a 12:00 habrá corte de agua por mantenimiento de la cisterna.',
    created_at: new Date().toISOString(),
  },
]

let reservations: Reservation[] = seedReservations()
let lostFoundReports: LostFoundReport[] = seedLostFound()
let notifications: DemoNotification[] = []
let demoIsOwner = false

interface MockResult<T> {
  data: T | null
  error: { code: string; message: string } | null
}

function profileFor(
  tenantId: string,
): Pick<Profile, 'first_name' | 'last_name' | 'room_number' | 'room_type' | 'floor' | 'phone'> {
  if (tenantId === DEMO_TENANT_ID) return DEMO_PROFILE
  return (
    NEIGHBOR_PROFILES[tenantId] ?? {
      first_name: 'Inquilino',
      last_name: '',
      room_number: '?',
      room_type: 'normal',
      floor: 'piso_2',
      phone: '',
    }
  )
}

function pushNotification(recipientId: string, title: string, body: string) {
  notifications = [
    { id: crypto.randomUUID(), recipientId, title, body, read: false, created_at: new Date().toISOString() },
    ...notifications,
  ]
}

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

function insertCharge(c: NewCharge) {
  charges = [...charges, { ...c, id: crypto.randomUUID(), created_at: new Date().toISOString() }]
  pushNotification(
    c.tenant_id,
    'Nuevo cobro',
    `${c.concept}: ${money(c.amount)}. Vence el ${c.due_date.slice(8)}/${c.due_date.slice(5, 7)}.`,
  )
}

export const mockDb = {
  getProfile(): Profile {
    return { ...DEMO_PROFILE, is_owner: demoIsOwner }
  },

  async getAllProfiles(): Promise<MockResult<Profile[]>> {
    const list: Profile[] = [
      { ...DEMO_PROFILE, is_owner: demoIsOwner },
      ...Object.entries(NEIGHBOR_PROFILES).map(([id, p]) => ({ id, ...p, is_owner: false })),
    ]
    return { data: list, error: null }
  },

  setDemoOwner(value: boolean) {
    demoIsOwner = value
  },

  async getOccupiedRanges(date: string): Promise<MockResult<OccupiedRange[]>> {
    const ranges = reservations
      .filter((r) => dateOf(r.starts_at) === date || dateOf(r.ends_at) === date)
      .map((r) => ({ starts_at: r.starts_at, ends_at: r.ends_at, machine: r.machine }))
    return { data: ranges, error: null }
  },

  async getMyReservations(tenantId: string): Promise<MockResult<Reservation[]>> {
    const nowIso = nowLocalDateTime()
    const mine = reservations
      .filter((r) => r.tenant_id === tenantId && r.ends_at >= nowIso)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return { data: mine, error: null }
  },

  async createReservation(tenantId: string, startsAt: string, machine: number): Promise<MockResult<Reservation>> {
    const nowIso = nowLocalDateTime()
    if (startsAt < nowIso) {
      return {
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy for table "reservations"' },
      }
    }

    const sameWeek = reservations.find(
      (r) => r.tenant_id === tenantId && isoWeekKey(dateOf(r.starts_at)) === isoWeekKey(dateOf(startsAt)),
    )
    if (sameWeek) {
      return { data: null, error: { code: 'P0001', message: 'El inquilino ya tiene una reserva para esta semana.' } }
    }

    const endsAt = reservationEnd(startsAt)
    const overlap = reservations.find((r) => r.machine === machine && rangesOverlap(startsAt, endsAt, r.starts_at, r.ends_at))
    if (overlap) {
      return {
        data: null,
        error: {
          code: '23P01',
          message: 'conflicting key value violates exclusion constraint "no_overlapping_reservations"',
        },
      }
    }

    const newReservation: Reservation = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      starts_at: startsAt,
      ends_at: endsAt,
      machine,
      created_at: new Date().toISOString(),
    }
    reservations = [...reservations, newReservation]

    const tenant = profileFor(tenantId)
    const formatted = `${formatShortDateTime(startsAt)} (lavadora ${machine})`
    const now = new Date().toISOString()
    notifications = [
      {
        id: crypto.randomUUID(),
        recipientId: tenantId,
        title: 'Reserva confirmada',
        body: `Tu turno de lavadora es el ${formatted}.`,
        read: false,
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        recipientId: OWNER_RECIPIENT,
        title: 'Nueva reserva',
        body: `${tenant.first_name} ${tenant.last_name} (Hab. ${tenant.room_number}) reservó para el ${formatted}.`,
        read: false,
        created_at: now,
      },
      ...notifications,
    ]

    return { data: newReservation, error: null }
  },

  async cancelReservation(id: string, tenantId: string, isOwner: boolean): Promise<MockResult<null>> {
    const exists = reservations.find((r) => r.id === id && (r.tenant_id === tenantId || isOwner))
    if (!exists) {
      return { data: null, error: { code: '42501', message: 'No tienes permiso para cancelar esta reserva.' } }
    }
    reservations = reservations.filter((r) => r.id !== id)
    return { data: null, error: null }
  },

  async getOwnerReservations(weekStart: string, weekEnd: string): Promise<MockResult<ReservationWithDetails[]>> {
    const list = reservations
      .filter((r) => dateOf(r.starts_at) >= weekStart && dateOf(r.starts_at) <= weekEnd)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((r) => ({
        ...r,
        profiles: profileFor(r.tenant_id),
      }))
    return { data: list, error: null }
  },

  async getLostFoundBoard(): Promise<MockResult<LostFoundReport[]>> {
    const sorted = [...lostFoundReports].sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
      return b.created_at.localeCompare(a.created_at)
    })
    return { data: sorted, error: null }
  },

  async createLostFoundReport(
    reporterId: string,
    reportType: LostFoundType,
    description: string,
    location: string | null,
    photoUrl: string | null,
  ): Promise<MockResult<LostFoundReport>> {
    const profile = profileFor(reporterId === DEMO_TENANT_ID ? DEMO_TENANT_ID : reporterId)
    const report: LostFoundReport = {
      id: crypto.randomUUID(),
      reporter_id: reporterId,
      report_type: reportType,
      description,
      location,
      photo_url: photoUrl,
      resolved: false,
      created_at: new Date().toISOString(),
      ...profile,
    }
    lostFoundReports = [report, ...lostFoundReports]
    return { data: report, error: null }
  },

  async setLostFoundResolved(id: string, resolved: boolean, actorId: string, isOwner: boolean): Promise<MockResult<null>> {
    const report = lostFoundReports.find((r) => r.id === id)
    if (!report || (report.reporter_id !== actorId && !isOwner)) {
      return { data: null, error: { code: '42501', message: 'No tienes permiso para modificar este reporte.' } }
    }
    lostFoundReports = lostFoundReports.map((r) => (r.id === id ? { ...r, resolved } : r))
    return { data: null, error: null }
  },

  async deleteLostFoundReport(id: string, actorId: string, isOwner: boolean): Promise<MockResult<null>> {
    const report = lostFoundReports.find((r) => r.id === id)
    if (!report || (report.reporter_id !== actorId && !isOwner)) {
      return { data: null, error: { code: '42501', message: 'No tienes permiso para eliminar este reporte.' } }
    }
    lostFoundReports = lostFoundReports.filter((r) => r.id !== id)
    return { data: null, error: null }
  },

  async getNotifications(isOwner: boolean): Promise<MockResult<AppNotification[]>> {
    const recipient = isOwner ? OWNER_RECIPIENT : DEMO_TENANT_ID
    const list = notifications
      .filter((n) => n.recipientId === recipient)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ recipientId: _recipientId, ...n }) => n)
    return { data: list, error: null }
  },

  async markNotificationRead(id: string, _isOwner: boolean): Promise<MockResult<null>> {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    return { data: null, error: null }
  },

  async markAllNotificationsRead(isOwner: boolean): Promise<MockResult<null>> {
    const recipient = isOwner ? OWNER_RECIPIENT : DEMO_TENANT_ID
    notifications = notifications.map((n) => (n.recipientId === recipient ? { ...n, read: true } : n))
    return { data: null, error: null }
  },

  // ---------- Arriendos ----------

  async getRentData(tenantId: string | null): Promise<MockResult<{ leases: Lease[]; charges: Charge[]; payments: Payment[] }>> {
    const mine = <T extends { tenant_id: string }>(list: T[]) => (tenantId ? list.filter((x) => x.tenant_id === tenantId) : list)
    return { data: { leases: mine(leases), charges: mine(charges), payments: mine(payments) }, error: null }
  },

  async upsertLease(lease: Lease): Promise<MockResult<null>> {
    leases = [...leases.filter((l) => l.tenant_id !== lease.tenant_id), lease]
    return { data: null, error: null }
  },

  async createCharges(list: NewCharge[]): Promise<MockResult<null>> {
    for (const c of list) {
      const duplicate =
        (c.kind === 'arriendo' || c.kind === 'lavadora') &&
        charges.some((x) => x.tenant_id === c.tenant_id && x.period === c.period && x.kind === c.kind)
      if (duplicate) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "charges_one_per_kind_idx"' } }
      }
      insertCharge(c)
    }
    return { data: null, error: null }
  },

  async deleteCharge(id: string): Promise<MockResult<null>> {
    if (payments.some((p) => p.charge_id === id)) {
      return { data: null, error: { code: '23503', message: 'violates foreign key constraint on payments' } }
    }
    charges = charges.filter((c) => c.id !== id)
    return { data: null, error: null }
  },

  async createPayment(
    p: { charge_id: string; tenant_id: string; amount: number; method: Payment['method']; paid_on: string; note: string | null },
    receiptPath: string | null,
    status: PaymentStatus,
  ): Promise<MockResult<null>> {
    const charge = charges.find((c) => c.id === p.charge_id)
    if (!charge) return { data: null, error: { code: '42501', message: 'row-level security' } }
    payments = [
      ...payments,
      { ...p, id: crypto.randomUUID(), receipt_path: receiptPath, status, review_note: null, created_at: new Date().toISOString() },
    ]
    if (status === 'pendiente') {
      const t = profileFor(p.tenant_id)
      pushNotification(
        OWNER_RECIPIENT,
        'Pago por revisar',
        `${t.first_name} ${t.last_name} (Hab. ${t.room_number}) reportó ${money(p.amount)} por ${charge.concept}.`,
      )
    } else {
      pushNotification(p.tenant_id, 'Pago registrado', `Se registró tu pago de ${money(p.amount)} por ${charge.concept}.`)
    }
    return { data: null, error: null }
  },

  async reviewPayment(id: string, status: PaymentStatus, note: string | null): Promise<MockResult<null>> {
    const p = payments.find((x) => x.id === id)
    if (!p) return { data: null, error: { code: '42501', message: 'row-level security' } }
    payments = payments.map((x) => (x.id === id ? { ...x, status, review_note: note } : x))
    const concept = charges.find((c) => c.id === p.charge_id)?.concept ?? 'un cobro'
    pushNotification(
      p.tenant_id,
      status === 'aprobado' ? 'Pago aprobado' : 'Pago rechazado',
      `Tu pago de ${money(p.amount)} por ${concept} fue ${status === 'aprobado' ? 'aprobado' : 'rechazado'}.`,
    )
    return { data: null, error: null }
  },

  async deletePayment(id: string): Promise<MockResult<null>> {
    payments = payments.filter((p) => p.id !== id)
    return { data: null, error: null }
  },

  async runRentJob(): Promise<MockResult<null>> {
    const month = periodOf(todayLocalISO())
    for (const l of leases) {
      if (!l.active || l.monthly_rent <= 0) continue
      if (charges.some((c) => c.tenant_id === l.tenant_id && c.period === month && c.kind === 'arriendo')) continue
      insertCharge({
        tenant_id: l.tenant_id,
        period: month,
        kind: 'arriendo',
        concept: `Arriendo ${month.slice(5, 7)}/${month.slice(0, 4)}`,
        amount: l.monthly_rent,
        due_date: `${month.slice(0, 8)}${String(l.due_day).padStart(2, '0')}`,
      })
    }
    return { data: null, error: null }
  },

  async remindTenant(chargeId: string): Promise<MockResult<null>> {
    const c = charges.find((x) => x.id === chargeId)
    if (c) pushNotification(c.tenant_id, 'Recordatorio de pago', `${c.concept} por ${money(c.amount)}. Revisa la pestaña Pagos.`)
    return { data: null, error: null }
  },

  async addLaundryCharges(period: string, price: number): Promise<MockResult<number>> {
    const counts = new Map<string, number>()
    for (const r of reservations) {
      if (periodOf(dateOf(r.starts_at)) === period) counts.set(r.tenant_id, (counts.get(r.tenant_id) ?? 0) + 1)
    }
    const [y, m] = period.split('-').map(Number)
    const dueDate = `${period.slice(0, 8)}${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    let affected = 0
    for (const [tenant_id, count] of counts) {
      const concept = `Lavadora ${period.slice(5, 7)}/${period.slice(0, 4)} (${count} usos)`
      const existing = charges.find((c) => c.tenant_id === tenant_id && c.period === period && c.kind === 'lavadora')
      if (existing) {
        if (payments.some((p) => p.charge_id === existing.id && p.status === 'aprobado')) continue
        charges = charges.map((c) => (c.id === existing.id ? { ...c, concept, amount: count * price } : c))
      } else {
        insertCharge({ tenant_id, period, kind: 'lavadora', concept, amount: count * price, due_date: dueDate })
      }
      affected++
    }
    return { data: affected, error: null }
  },

  async getPaymentInstructions(): Promise<MockResult<string>> {
    return { data: paymentInstructions, error: null }
  },

  async savePaymentInstructions(text: string): Promise<MockResult<null>> {
    paymentInstructions = text
    return { data: null, error: null }
  },
  // ---------- Mantenimiento y avisos ----------

  async getMaintenance(tenantId: string | null): Promise<MockResult<MaintenanceRequest[]>> {
    const list = maintenance
      .filter((m) => !tenantId || m.tenant_id === tenantId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return { data: list, error: null }
  },

  async createMaintenance(
    tenantId: string,
    category: MaintenanceCategory,
    description: string,
    photoPath: string | null,
  ): Promise<MockResult<null>> {
    maintenance = [
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        category,
        description,
        photo_path: photoPath,
        status: 'pendiente',
        response: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
      },
      ...maintenance,
    ]
    const t = profileFor(tenantId)
    pushNotification(OWNER_RECIPIENT, 'Nueva falla reportada', `${t.first_name} ${t.last_name} (Hab. ${t.room_number}): ${description.slice(0, 80)}`)
    return { data: null, error: null }
  },

  async updateMaintenance(id: string, status: MaintenanceStatus, response: string | null): Promise<MockResult<null>> {
    const m = maintenance.find((x) => x.id === id)
    if (!m) return { data: null, error: { code: '42501', message: 'row-level security' } }
    maintenance = maintenance.map((x) =>
      x.id === id ? { ...x, status, response, resolved_at: status === 'resuelto' ? new Date().toISOString() : null } : x,
    )
    pushNotification(m.tenant_id, `Tu reporte está ${status === 'en_proceso' ? 'en proceso' : status}`, m.description.slice(0, 60))
    return { data: null, error: null }
  },

  async deleteMaintenance(id: string): Promise<MockResult<null>> {
    maintenance = maintenance.filter((m) => m.id !== id)
    return { data: null, error: null }
  },

  async getAnnouncements(): Promise<MockResult<Announcement[]>> {
    return { data: [...announcements].sort((a, b) => b.created_at.localeCompare(a.created_at)), error: null }
  },

  async createAnnouncement(title: string, body: string): Promise<MockResult<null>> {
    announcements = [{ id: crypto.randomUUID(), title, body, created_at: new Date().toISOString() }, ...announcements]
    pushNotification(DEMO_TENANT_ID, `Aviso: ${title}`, body.slice(0, 140))
    return { data: null, error: null }
  },

  async deleteAnnouncement(id: string): Promise<MockResult<null>> {
    announcements = announcements.filter((a) => a.id !== id)
    return { data: null, error: null }
  },
}
