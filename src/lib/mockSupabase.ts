import type { LostFoundReport, LostFoundType, OccupiedRange, Profile, Reservation, ReservationWithDetails } from './types'
import { dateOf, isoWeekKey, nowLocalDateTime, rangesOverlap, reservationEnd, todayLocalISO, combineDateAndTime } from './dateUtils'

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
  const seeds: Array<{ id: string; tenant_id: string; date: string; time: string }> = [
    { id: 'seed-1', tenant_id: 'neighbor-1', date: today, time: '17:30' },
    { id: 'seed-2', tenant_id: 'neighbor-2', date: addDays(today, 1), time: '10:30' },
    { id: 'seed-3', tenant_id: 'neighbor-3', date: addDays(today, 2), time: '23:30' },
  ]
  return seeds.map((s) => {
    const starts_at = combineDateAndTime(s.date, s.time)
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      starts_at,
      ends_at: reservationEnd(starts_at),
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
      resolved: false,
      created_at: now,
      ...NEIGHBOR_PROFILES['neighbor-3'],
    },
  ]
}

let reservations: Reservation[] = seedReservations()
let lostFoundReports: LostFoundReport[] = seedLostFound()
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

export const mockDb = {
  getProfile(): Profile {
    return { ...DEMO_PROFILE, is_owner: demoIsOwner }
  },

  setDemoOwner(value: boolean) {
    demoIsOwner = value
  },

  async getOccupiedRanges(date: string): Promise<MockResult<OccupiedRange[]>> {
    const ranges = reservations
      .filter((r) => dateOf(r.starts_at) === date || dateOf(r.ends_at) === date)
      .map((r) => ({ starts_at: r.starts_at, ends_at: r.ends_at }))
    return { data: ranges, error: null }
  },

  async getMyReservations(tenantId: string): Promise<MockResult<Reservation[]>> {
    const nowIso = nowLocalDateTime()
    const mine = reservations
      .filter((r) => r.tenant_id === tenantId && r.ends_at >= nowIso)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return { data: mine, error: null }
  },

  async createReservation(tenantId: string, startsAt: string): Promise<MockResult<Reservation>> {
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
    const overlap = reservations.find((r) => rangesOverlap(startsAt, endsAt, r.starts_at, r.ends_at))
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
      created_at: new Date().toISOString(),
    }
    reservations = [...reservations, newReservation]
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
  ): Promise<MockResult<LostFoundReport>> {
    const profile = profileFor(reporterId === DEMO_TENANT_ID ? DEMO_TENANT_ID : reporterId)
    const report: LostFoundReport = {
      id: crypto.randomUUID(),
      reporter_id: reporterId,
      report_type: reportType,
      description,
      location,
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
}
