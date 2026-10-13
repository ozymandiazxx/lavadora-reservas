export type RoomType = 'normal' | 'suite'

export type Floor = 'subsuelo' | 'piso_2' | 'piso_3' | 'terraza'

export type LostFoundType = 'perdido' | 'encontrado'

export interface Profile {
  id: string
  first_name: string
  last_name: string
  room_number: string
  room_type: RoomType
  floor: Floor
  phone: string
  is_owner: boolean
}

export interface Reservation {
  id: string
  tenant_id: string
  /** Fecha y hora local sin zona horaria, formato "YYYY-MM-DDTHH:mm:ss". */
  starts_at: string
  ends_at: string
  /** Lavadora (1 a 3). */
  machine: number
  created_at: string
}

export interface ReservationWithDetails extends Reservation {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'room_number' | 'room_type' | 'floor' | 'phone'> | null
}

/** Rango horario ocupado en un día, sin datos de a quién pertenece. */
export interface OccupiedRange {
  starts_at: string
  ends_at: string
  machine: number
}

export interface LostFoundReport {
  id: string
  reporter_id: string
  report_type: LostFoundType
  description: string
  location: string | null
  photo_url: string | null
  resolved: boolean
  created_at: string
  first_name: string
  last_name: string
  room_number: string
  phone: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export type ChargeKind = 'arriendo' | 'lavadora' | 'servicio' | 'otro'

export type PaymentMethod = 'transferencia' | 'efectivo'

export type PaymentStatus = 'pendiente' | 'aprobado' | 'rechazado'

export interface Lease {
  tenant_id: string
  monthly_rent: number
  /** Día del mes (1-28) en que vence el arriendo. */
  due_day: number
  late_fee_per_day: number
  active: boolean
  /** "YYYY-MM-DD" o null. */
  move_in_date: string | null
  /** Día de pago que pidió el inquilino y la dueña aún no resolvió. */
  requested_due_day: number | null
}

/** Lo que la dueña edita en las condiciones del arriendo (la solicitud del inquilino no se toca). */
export type LeaseInput = Omit<Lease, 'requested_due_day'>

export interface Charge {
  id: string
  tenant_id: string
  /** Primer día del mes al que pertenece el cobro, "YYYY-MM-01". */
  period: string
  kind: ChargeKind
  concept: string
  amount: number
  /** "YYYY-MM-DD". */
  due_date: string
  created_at: string
}

export interface Payment {
  id: string
  charge_id: string
  tenant_id: string
  amount: number
  method: PaymentMethod
  /** "YYYY-MM-DD". */
  paid_on: string
  receipt_path: string | null
  note: string | null
  status: PaymentStatus
  review_note: string | null
  created_at: string
}

export interface NewPayment {
  charge_id: string
  tenant_id: string
  amount: number
  method: PaymentMethod
  paid_on: string
  note: string | null
  receipt: File | null
}

export interface NewCharge {
  tenant_id: string
  period: string
  kind: ChargeKind
  concept: string
  amount: number
  due_date: string
}

export type MaintenanceCategory = 'lavadora' | 'luz' | 'agua' | 'internet' | 'habitacion' | 'otro'

export type MaintenanceStatus = 'pendiente' | 'en_proceso' | 'resuelto'

export interface MaintenanceRequest {
  id: string
  tenant_id: string
  category: MaintenanceCategory
  description: string
  photo_path: string | null
  status: MaintenanceStatus
  response: string | null
  created_at: string
  resolved_at: string | null
}

export interface Announcement {
  id: string
  title: string
  body: string
  created_at: string
}

export interface PostgrestLikeError {
  message: string
  code: string
  details?: string | null
  hint?: string | null
}
