/** Cantidad de lavadoras del edificio (el CHECK de `reservations.machine` en SQL debe coincidir). */
export const MACHINE_COUNT = 3
export const MACHINES = Array.from({ length: MACHINE_COUNT }, (_, i) => i + 1)

/** Duración fija de un ciclo de lavado/secado, en minutos. Debe coincidir con el trigger de la migración SQL. */
export const RESERVATION_DURATION_MINUTES = 105
