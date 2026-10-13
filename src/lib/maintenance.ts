import type { MaintenanceCategory, MaintenanceStatus } from './types'

export const CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  lavadora: 'Lavadora',
  luz: 'Luz',
  agua: 'Agua',
  internet: 'Internet',
  habitacion: 'Habitación',
  otro: 'Otro',
}

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as MaintenanceCategory[]

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
}

export const MAINTENANCE_STATUS_STYLE: Record<MaintenanceStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  en_proceso: 'bg-sky-100 text-sky-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
}
