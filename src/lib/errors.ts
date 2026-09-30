import type { PostgrestLikeError } from './types'

/** Traduce errores de Postgres/RLS al mensaje que se muestra en el toast. */
export function classifyReservationError(error: PostgrestLikeError): string {
  const msg = error.message ?? ''

  if (
    error.code === 'P0001' ||
    msg.includes('one_reservation_per_week') ||
    msg.toLowerCase().includes('ya tiene una reserva')
  ) {
    return 'Ya tienes una reserva esta semana. Solo puedes reservar la lavadora una vez por semana.'
  }

  if (error.code === '23P01' || msg.includes('no_overlapping_reservations')) {
    return 'Ese horario se superpone con otra reserva. Elige un horario libre.'
  }

  if (error.code === '23505') {
    return 'Ese horario acaba de ser reservado por otro inquilino. Elige otro horario.'
  }

  if (error.code === '42501') {
    return 'No tienes permiso para realizar esta acción.'
  }

  return 'Ocurrió un error inesperado. Intenta nuevamente.'
}
