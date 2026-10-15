import { Canvas } from '@react-three/fiber'
import { Edges, Html, OrbitControls } from '@react-three/drei'
import { FLOOR_LABEL, FLOORS } from '@/lib/rooms'
import type { Floor } from '@/lib/types'

export interface RoomCell {
  key: string
  floor: Floor
  /** Número de habitación; las libres de piso 2/3 también tienen número. */
  number: string
  /** Color ya resuelto según el modo (pagos o consumo). */
  color: string
  /** Habitación sin inquilino registrado: se dibuja translúcida. */
  vacant: boolean
}

// Paleta tomada de las fotos del edificio: paredes marfil, puertas de madera, cerámica clara.
const DOOR = '#7a4a2e'
const CERAMIC = '#e4d9c6'
const SLAB = '#b9b2a5'
const RAIL = '#e8e6e1'
const STAIR = '#d9cdb8'

const FLOOR_HEIGHT = 2.9
const ROOM_H = 0.95
const S = 1.45 // ancho de una habitación a lo largo del pasillo
const D = 1.7 // fondo de una habitación
const C = 1.0 // ancho del pasillo
const HW = 2.2 // medio ancho del vacío central (patio)
const HD = 1.8 // medio fondo del vacío central

type Facing = 'east' | 'west' | 'south'
interface Slot {
  x: number
  z: number
  /** Cara por la que se ve la puerta (hacia el pasillo). */
  facing: Facing
}

/**
 * Pisos 2 y 3 (referencial): pasillo en U alrededor de un vacío central con pretil,
 * 5 habitaciones en el ala izquierda, 4 al fondo y 5 en el ala derecha (14 en total).
 * Las que sobren (números fuera de 1-14) se alinean al frente.
 */
function uShapeSlots(count: number): Slot[] {
  const leftX = -(HW + C + D / 2)
  const backZ = -(HD + C + D / 2)
  const slots: Slot[] = []
  for (let i = 0; i < 5; i++) slots.push({ x: leftX, z: 2.8 - i * S, facing: 'east' })
  for (let i = 0; i < 4; i++) slots.push({ x: -2.175 + i * S, z: backZ, facing: 'south' })
  for (let i = 0; i < 5; i++) slots.push({ x: -leftX, z: -3.0 + i * S, facing: 'west' })
  for (let i = 14; i < count; i++) slots.push({ x: -4 + (i - 14) * (S + 0.1), z: 6.4, facing: 'south' })
  return slots.slice(0, Math.max(count, 0))
}

/** Subsuelo y terraza (referencial): dos filas de suites con un pasillo en medio. */
function suiteSlots(count: number): Slot[] {
  const perRow = Math.max(1, Math.ceil(count / 2))
  return Array.from({ length: count }, (_, i) => {
    const row = i < perRow ? 0 : 1
    const col = row === 0 ? i : i - perRow
    return {
      x: (col - (perRow - 1) / 2) * (S + 0.15),
      z: row === 0 ? -(D / 2 + C / 2) : D / 2 + C / 2,
      facing: 'south' as const,
    }
  })
}

const isSuiteFloor = (f: Floor) => f === 'subsuelo' || f === 'terraza'

/** Puerta de madera pegada a la cara de la habitación que da al pasillo. */
function Door({ facing }: { facing: Facing }) {
  const off = D / 2 + 0.02
  const pos: [number, number, number] =
    facing === 'east' ? [off, -0.12, 0] : facing === 'west' ? [-off, -0.12, 0] : [0, -0.12, off]
  const size: [number, number, number] = facing === 'south' ? [0.5, 0.72, 0.05] : [0.05, 0.72, 0.5]
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={DOOR} />
    </mesh>
  )
}

function Corridors() {
  return (
    <group position={[0, -0.43, 0]}>
      {/* Losas de cada ala */}
      <mesh position={[-3.55, -0.07, 0.375]}>
        <boxGeometry args={[2.7, 0.12, 7.25]} />
        <meshStandardMaterial color={SLAB} />
      </mesh>
      <mesh position={[3.55, -0.07, 0.375]}>
        <boxGeometry args={[2.7, 0.12, 7.25]} />
        <meshStandardMaterial color={SLAB} />
      </mesh>
      <mesh position={[0, -0.07, -3.15]}>
        <boxGeometry args={[4.4, 0.12, 2.7]} />
        <meshStandardMaterial color={SLAB} />
      </mesh>
      {/* Cerámica del pasillo */}
      <mesh position={[-(HW + C / 2), 0.0, 0.375]}>
        <boxGeometry args={[C, 0.03, 7.25]} />
        <meshStandardMaterial color={CERAMIC} />
      </mesh>
      <mesh position={[HW + C / 2, 0.0, 0.375]}>
        <boxGeometry args={[C, 0.03, 7.25]} />
        <meshStandardMaterial color={CERAMIC} />
      </mesh>
      <mesh position={[0, 0.0, -(HD + C / 2)]}>
        <boxGeometry args={[2 * (HW + C), 0.03, C]} />
        <meshStandardMaterial color={CERAMIC} />
      </mesh>
      {/* Pretil abierto hacia el patio central */}
      {(
        [
          [-HW, 0.17, 0.875, 0.06, 0.34, 5.35],
          [HW, 0.17, 0.875, 0.06, 0.34, 5.35],
          [0, 0.17, -HD, 2 * HW, 0.34, 0.06],
        ] as const
      ).map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={RAIL} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function SuiteSlab() {
  return (
    <group position={[0, -0.43, 0]}>
      <mesh position={[0, -0.07, 0]}>
        <boxGeometry args={[8.6, 0.12, 3.9]} />
        <meshStandardMaterial color={SLAB} />
      </mesh>
      <mesh>
        <boxGeometry args={[8.2, 0.03, C]} />
        <meshStandardMaterial color={CERAMIC} />
      </mesh>
    </group>
  )
}

/** Escalera en el extremo del ala izquierda, subiendo un piso por tramo. */
function Stairs({ from, to }: { from: number; to: number }) {
  const steps = 8
  const rise = FLOOR_HEIGHT / steps
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => {
        const h = (i + 1) * rise
        return (
          <mesh key={i} position={[-(HW + C / 2), from * FLOOR_HEIGHT - 0.43 + h / 2, 3.85 + i * 0.18]}>
            <boxGeometry args={[C * 0.9, h, 0.18]} />
            <meshStandardMaterial color={STAIR} />
          </mesh>
        )
      })}
      <mesh position={[-(HW + C / 2), to * FLOOR_HEIGHT - 0.5, 3.45]}>
        <boxGeometry args={[C, 0.07, 0.8]} />
        <meshStandardMaterial color={SLAB} />
      </mesh>
    </group>
  )
}

interface Building3DProps {
  cells: RoomCell[]
  selectedKey: string | null
  /** Si es un piso, solo se dibuja ese; el resto se oculta para poder tocar las habitaciones. */
  onlyFloor: Floor | null
  onSelect: (key: string | null) => void
}

export function Building3D({ cells, selectedKey, onlyFloor, onSelect }: Building3DProps) {
  const visibleFloors = FLOORS.filter((f) => !onlyFloor || f === onlyFloor)

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [15, 9, 17], fov: 40 }}
      onPointerMissed={() => onSelect(null)}
      style={{ touchAction: 'none' }}
    >
      <ambientLight intensity={1.15} />
      <directionalLight position={[8, 12, 6]} intensity={1.5} />
      <directionalLight position={[-8, 5, -6]} intensity={0.5} />

      <group>
        {visibleFloors.map((floor) => {
          const level = onlyFloor ? 0 : FLOORS.indexOf(floor)
          const floorCells = cells.filter((c) => c.floor === floor)
          const suite = isSuiteFloor(floor)
          const slots = suite ? suiteSlots(floorCells.length) : uShapeSlots(floorCells.length)
          return (
            <group key={floor} position={[0, level * FLOOR_HEIGHT, 0]}>
              {suite ? <SuiteSlab /> : <Corridors />}

              {floorCells.map((cell, i) => {
                const slot = slots[i]
                if (!slot) return null
                const selected = cell.key === selectedKey
                const facing = slot.facing
                return (
                  <group key={cell.key} position={[slot.x, 0, slot.z]}>
                    <mesh
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(cell.key)
                      }}
                      scale={selected ? [1.03, 1.08, 1.03] : [1, 1, 1]}
                    >
                      <boxGeometry args={[facing === 'south' ? S - 0.06 : D - 0.06, ROOM_H, facing === 'south' ? D - 0.06 : S - 0.06]} />
                      <meshStandardMaterial
                        color={cell.color}
                        transparent={cell.vacant}
                        opacity={cell.vacant ? 0.35 : 1}
                        emissive={selected ? '#ffffff' : '#000000'}
                        emissiveIntensity={selected ? 0.35 : 0}
                      />
                      <Edges color={selected ? '#0f172a' : '#6b6558'} lineWidth={selected ? 2 : 1} />
                    </mesh>
                    <Door facing={facing} />
                  </group>
                )
              })}

              <Html position={[-6.4, 0.2, 0]} center style={{ pointerEvents: 'none' }}>
                <span className="rounded-full bg-slate-800/85 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-white">
                  {FLOOR_LABEL[floor]}
                </span>
              </Html>
            </group>
          )
        })}

        {/* Escalera entre los pisos 2 y 3 (referencial) */}
        {!onlyFloor && <Stairs from={FLOORS.indexOf('piso_2')} to={FLOORS.indexOf('piso_3')} />}
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={34}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, onlyFloor ? 0 : 3.6, -0.3]}
        makeDefault
      />
    </Canvas>
  )
}
