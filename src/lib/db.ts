import { isDemoMode, supabase } from './supabase'
import { DEMO_TENANT_ID, mockDb } from './mockSupabase'
import { nowLocalDateTime, weekDates } from './dateUtils'
import type {
  AppNotification,
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
