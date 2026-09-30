import type { Floor } from './types'

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Supabase Auth necesita un email por dentro, pero acá se entra con
 * piso + número de habitación + contraseña. Este email sintético nunca
 * se muestra ni se envía a ningún lado; es solo el identificador interno.
 * El número de habitación se repite entre pisos (ej: piso 2 y piso 3
 * tienen ambos una "habitación 1"), así que el identificador único es
 * la combinación piso + habitación, no el número solo.
 */
export function loginEmailFor(floor: Floor, roomNumber: string): string {
  // Supabase valida que el TLD sea "real" (.interno/.local no pasan), así que
  // usamos un dominio con TLD válido aunque no exista de verdad.
  return `hab-${slugify(floor)}-${slugify(roomNumber)}@lavadora-interno.com`
}

/** Traduce errores de Supabase Auth a mensajes en español para el formulario. */
export function translateAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Ya existe una cuenta registrada con ese piso y número de habitación.'
  }
  if (msg.includes('invalid login credentials')) {
    return 'Piso, número de habitación o contraseña incorrectos.'
  }
  if (msg.includes('password') && msg.includes('least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  return message
}
