import type { Floor, RoomType } from './types'

export const FLOORS: Floor[] = ['subsuelo', 'piso_2', 'piso_3', 'terraza']

export const FLOOR_LABEL: Record<Floor, string> = {
  subsuelo: 'Subsuelo',
  piso_2: 'Piso 2',
  piso_3: 'Piso 3',
  terraza: 'Terraza',
}

/** Subsuelo y terraza son todas suites; pisos 2 y 3 son habitaciones normales. */
export function roomTypeForFloor(floor: Floor): RoomType {
  return floor === 'subsuelo' || floor === 'terraza' ? 'suite' : 'normal'
}
