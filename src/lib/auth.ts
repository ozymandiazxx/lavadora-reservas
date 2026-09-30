/**
 * Supabase Auth necesita un email por dentro, pero acá se entra con
 * número de habitación + contraseña. Este email sintético nunca se
 * muestra ni se envía a ningún lado; es solo el identificador interno.
 */
export function roomNumberToLoginEmail(roomNumber: string): string {
  const slug = roomNumber
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Supabase valida que el TLD sea "real" (.interno/.local no pasan), así que
  // usamos un dominio con TLD válido aunque no exista de verdad.
  return `hab-${slug}@lavadora-interno.com`
}

/** Traduce errores de Supabase Auth a mensajes en español para el formulario. */
export function translateAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Ya existe una cuenta registrada con ese número de habitación.'
  }
  if (msg.includes('invalid login credentials')) {
    return 'Número de habitación o contraseña incorrectos.'
  }
  if (msg.includes('password') && msg.includes('least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  return message
}
