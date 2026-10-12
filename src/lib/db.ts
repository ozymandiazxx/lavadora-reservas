import { isDemoMode, supabase } from './supabase'
import { DEMO_TENANT_ID, mockDb } from './mockSupabase'
import { nowLocalDateTime, weekDates } from './dateUtils'
import type {
  AppNotification,
  Charge,
  Lease,
  NewCharge,
  NewPayment,
  Payment,
  PaymentStatus,
  LostFoundReport,
  LostFoundType,
  OccupiedRange,
  PostgrestLikeError,
  Profile,
  Reservation,
  ReservationWithDetails,
} from './types'

export { DEMO_TENANT_ID, isDemoMode }

export interface DbResult<T> {
  data: T | null
  error: PostgrestLikeError | null
}

function toDbError(error: unknown): PostgrestLikeError | null {
  if (!error) return null
  const e = error as { message?: string; code?: string }
  return { message: e.message ?? 'Error desconocido', code: e.code ?? 'unknown' }
}

export function setDemoOwner(value: boolean) {
  mockDb.setDemoOwner(value)
}

export async function fetchOccupiedRanges(date: string): Promise<DbResult<OccupiedRange[]>> {
  if (isDemoMode) return mockDb.getOccupiedRanges(date)
  const { data, error } = await supabase!.rpc('get_occupied_ranges', { p_date: date })
  return { data: data as OccupiedRange[] | null, error: toDbError(error) }
}

/** Rangos ocupados de los 7 días de la semana que empieza en `weekStart`, agrupados por fecha. */
export async function fetchOccupiedRangesForWeek(weekStart: string): Promise<DbResult<Record<string, OccupiedRange[]>>> {
  const dates = weekDates(weekStart)
  const results = await Promise.all(dates.map((date) => fetchOccupiedRanges(date)))
  const failed = results.find((r) => r.error)
  if (failed) return { data: null, error: failed.error }

  const byDate: Record<string, OccupiedRange[]> = {}
  dates.forEach((date, i) => {
    byDate[date] = results[i].data ?? []
  })
  return { data: byDate, error: null }
}

export async function fetchProfile(userId: string): Promise<DbResult<Profile>> {
  if (isDemoMode) return { data: mockDb.getProfile(), error: null }
  const { data, error } = await supabase!.from('profiles').select('*').eq('id', userId).single()
  return { data: data as Profile | null, error: toDbError(error) }
}

/** Todos los perfiles registrados (solo visible para la dueña, vía RLS). */
export async function fetchAllProfiles(): Promise<DbResult<Profile[]>> {
  if (isDemoMode) return mockDb.getAllProfiles()
  const { data, error } = await supabase!.from('profiles').select('*').order('floor').order('room_number')
  return { data: data as Profile[] | null, error: toDbError(error) }
}

export async function fetchMyReservations(tenantId: string): Promise<DbResult<Reservation[]>> {
  if (isDemoMode) return mockDb.getMyReservations(tenantId)
  const { data, error } = await supabase!
    .from('reservations')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('ends_at', nowLocalDateTime())
    .order('starts_at')
  return { data: data as Reservation[] | null, error: toDbError(error) }
}

export async function createReservation(tenantId: string, startsAt: string): Promise<DbResult<Reservation>> {
  if (isDemoMode) return mockDb.createReservation(tenantId, startsAt)
  const { data, error } = await supabase!.from('reservations').insert({ starts_at: startsAt }).select().single()
  return { data: data as Reservation | null, error: toDbError(error) }
}

export async function cancelReservation(id: string, tenantId: string, isOwner: boolean): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.cancelReservation(id, tenantId, isOwner)
  const { error } = await supabase!.from('reservations').delete().eq('id', id)
  return { data: null, error: toDbError(error) }
}

/** Trae las reservas entre `start` y `end` (fechas YYYY-MM-DD, inclusive) con datos del inquilino. */
export async function fetchOwnerReservations(start: string, end: string): Promise<DbResult<ReservationWithDetails[]>> {
  if (isDemoMode) return mockDb.getOwnerReservations(start, end)

  const { data: rows, error } = await supabase!
    .from('reservations')
    .select('*')
    .gte('starts_at', `${start}T00:00:00`)
    .lt('starts_at', `${end}T23:59:59.999`)
    .order('starts_at')
  if (error) return { data: null, error: toDbError(error) }

  const reservations = (rows ?? []) as Reservation[]
  const tenantIds = [...new Set(reservations.map((r) => r.tenant_id))]

  const profilesById = new Map<
    string,
    Pick<Profile, 'first_name' | 'last_name' | 'room_number' | 'room_type' | 'floor' | 'phone'>
  >()
  if (tenantIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase!
      .from('profiles')
      .select('id, first_name, last_name, room_number, room_type, floor, phone')
      .in('id', tenantIds)
    if (profilesError) return { data: null, error: toDbError(profilesError) }
    for (const p of profilesData ?? []) {
      profilesById.set(p.id, p)
    }
  }

  const merged: ReservationWithDetails[] = reservations.map((r) => ({
    ...r,
    profiles: profilesById.get(r.tenant_id) ?? null,
  }))
  return { data: merged, error: null }
}

export async function fetchLostFoundBoard(): Promise<DbResult<LostFoundReport[]>> {
  if (isDemoMode) return mockDb.getLostFoundBoard()
  const { data, error } = await supabase!.rpc('get_lost_found_board')
  return { data: data as LostFoundReport[] | null, error: toDbError(error) }
}

export async function createLostFoundReport(
  reporterId: string,
  reportType: LostFoundType,
  description: string,
  location: string | null,
  photo: File | null,
): Promise<DbResult<null>> {
  if (isDemoMode) {
    const photoUrl = photo ? URL.createObjectURL(photo) : null
    const { error } = await mockDb.createLostFoundReport(reporterId, reportType, description, location, photoUrl)
    return { data: null, error: toDbError(error) }
  }

  let photoUrl: string | null = null
  if (photo) {
    const path = `${reporterId}/${crypto.randomUUID()}-${photo.name}`
    const { error: uploadError } = await supabase!.storage.from('lost-found').upload(path, photo)
    if (uploadError) return { data: null, error: toDbError(uploadError) }
    photoUrl = supabase!.storage.from('lost-found').getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase!
    .from('lost_found_reports')
    .insert({ report_type: reportType, description, location, photo_url: photoUrl })
  return { data: null, error: toDbError(error) }
}

export async function setLostFoundResolved(
  id: string,
  resolved: boolean,
  actorId: string,
  isOwner: boolean,
): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.setLostFoundResolved(id, resolved, actorId, isOwner)
  const { error } = await supabase!.from('lost_found_reports').update({ resolved }).eq('id', id)
  return { data: null, error: toDbError(error) }
}

export async function deleteLostFoundReport(id: string, actorId: string, isOwner: boolean): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.deleteLostFoundReport(id, actorId, isOwner)
  const { error } = await supabase!.from('lost_found_reports').delete().eq('id', id)
  return { data: null, error: toDbError(error) }
}

export async function fetchNotifications(userId: string, isOwner: boolean): Promise<DbResult<AppNotification[]>> {
  if (isDemoMode) return mockDb.getNotifications(isOwner)
  const { data, error } = await supabase!
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return { data: data as AppNotification[] | null, error: toDbError(error) }
}

export async function markNotificationRead(id: string, isOwner: boolean): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.markNotificationRead(id, isOwner)
  const { error } = await supabase!.from('notifications').update({ read: true }).eq('id', id)
  return { data: null, error: toDbError(error) }
}

export async function markAllNotificationsRead(userId: string, isOwner: boolean): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.markAllNotificationsRead(isOwner)
  const { error } = await supabase!.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  return { data: null, error: toDbError(error) }
}

// ---------- Arriendos ----------

export interface RentData {
  leases: Lease[]
  charges: Charge[]
  payments: Payment[]
}

/** Contratos, cobros y pagos. Con `tenantId` solo los de ese inquilino; con null, todos (dueña). */
export async function fetchRentData(tenantId: string | null): Promise<DbResult<RentData>> {
  if (isDemoMode) return mockDb.getRentData(tenantId)

  const table = (name: string) => {
    const query = supabase!.from(name).select('*')
    return tenantId ? query.eq('tenant_id', tenantId) : query
  }
  const [leases, charges, payments] = await Promise.all([
    table('leases'),
    table('charges').order('period', { ascending: false }).order('created_at'),
    table('payments').order('created_at'),
  ])
  const error = leases.error ?? charges.error ?? payments.error
  if (error) return { data: null, error: toDbError(error) }
  return {
    data: {
      leases: leases.data as Lease[],
      charges: charges.data as Charge[],
      payments: payments.data as Payment[],
    },
    error: null,
  }
}

export async function upsertLease(lease: Lease): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.upsertLease(lease)
  const { error } = await supabase!.from('leases').upsert({ ...lease, updated_at: new Date().toISOString() })
  return { data: null, error: toDbError(error) }
}

export async function createCharges(list: NewCharge[]): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.createCharges(list)
  const { error } = await supabase!.from('charges').insert(list)
  return { data: null, error: toDbError(error) }
}

export async function deleteCharge(id: string): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.deleteCharge(id)
  const { error } = await supabase!.from('charges').delete().eq('id', id)
  return { data: null, error: toDbError(error) }
}

/**
 * El inquilino reporta un pago (queda "pendiente" hasta que la dueña lo apruebe).
 * La dueña (`asOwner`) lo registra directamente como aprobado.
 */
export async function createPayment(payment: NewPayment, asOwner: boolean): Promise<DbResult<null>> {
  const { receipt, ...fields } = payment
  const status: PaymentStatus = asOwner ? 'aprobado' : 'pendiente'

  if (isDemoMode) {
    return mockDb.createPayment(fields, receipt ? URL.createObjectURL(receipt) : null, status)
  }

  let receiptPath: string | null = null
  if (receipt) {
    // La carpeta es el id de quien sube: la policy de storage solo deja escribir en la propia.
    receiptPath = `${payment.tenant_id}/${crypto.randomUUID()}-${receipt.name.replace(/[^\w.-]/g, '_')}`
    const { error: uploadError } = await supabase!.storage.from('receipts').upload(receiptPath, receipt)
    if (uploadError) return { data: null, error: toDbError(uploadError) }
  }

  const { error } = await supabase!.from('payments').insert({ ...fields, receipt_path: receiptPath, status })
  return { data: null, error: toDbError(error) }
}

export async function reviewPayment(id: string, status: PaymentStatus, note: string | null): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.reviewPayment(id, status, note)
  const { error } = await supabase!.from('payments').update({ status, review_note: note }).eq('id', id)
  return { data: null, error: toDbError(error) }
}

export async function deletePayment(id: string): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.deletePayment(id)
  const { error } = await supabase!.from('payments').delete().eq('id', id)
  return { data: null, error: toDbError(error) }
}

/** Genera el arriendo del mes y manda recordatorios pendientes (también corre a diario vía pg_cron). */
export async function runRentJob(): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.runRentJob()
  const { error } = await supabase!.rpc('rent_daily_job')
  return { data: null, error: toDbError(error) }
}

export async function remindTenant(chargeId: string): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.remindTenant(chargeId)
  const { error } = await supabase!.rpc('remind_tenant', { p_charge_id: chargeId })
  return { data: null, error: toDbError(error) }
}

/** Crea (o recalcula) el cobro de lavadora del mes: usos × precio. Devuelve cuántos inquilinos tocó. */
export async function addLaundryCharges(period: string, price: number): Promise<DbResult<number>> {
  if (isDemoMode) return mockDb.addLaundryCharges(period, price)
  const { data, error } = await supabase!.rpc('add_laundry_charges', { p_period: period, p_price: price })
  return { data: data as number | null, error: toDbError(error) }
}

/** URL temporal para ver un comprobante (el bucket es privado). */
export async function getReceiptUrl(path: string): Promise<string | null> {
  if (isDemoMode) return path
  const { data } = await supabase!.storage.from('receipts').createSignedUrl(path, 300)
  return data?.signedUrl ?? null
}

export async function fetchPaymentInstructions(): Promise<DbResult<string>> {
  if (isDemoMode) return mockDb.getPaymentInstructions()
  const { data, error } = await supabase!.from('rent_settings').select('payment_instructions').single()
  return { data: (data?.payment_instructions as string | undefined) ?? '', error: toDbError(error) }
}

export async function savePaymentInstructions(text: string): Promise<DbResult<null>> {
  if (isDemoMode) return mockDb.savePaymentInstructions(text)
  const { error } = await supabase!.from('rent_settings').update({ payment_instructions: text }).eq('singleton', true)
  return { data: null, error: toDbError(error) }
}
