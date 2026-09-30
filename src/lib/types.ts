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
  created_at: string
}

export interface ReservationWithDetails extends Reservation {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'room_number' | 'room_type' | 'floor' | 'phone'> | null
}

/** Rango horario ocupado en un día, sin datos de a quién pertenece. */
export interface OccupiedRange {
  starts_at: string
  ends_at: string
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

export interface PostgrestLikeError {
  message: string
  code: string
  details?: string | null
  hint?: string | null
}
