import { Canvas } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import { FLOORS } from '@/lib/rooms'
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

const FLOOR_HEIGHT = 1.35
const ROOM_W = 1.05
const ROOM_D = 1.3
const GAP = 0.12

/** Distribuye las habitaciones de un piso en dos filas separadas por un pasillo. */
function layout(count: number): Array<[number, number]> {
  const cols = Math.max(1, Math.ceil(count / 2))
  return Array.from({ length: count }, (_, i) => {
    const row = i < cols ? 0 : 1
    const col = row === 0 ? i : i - cols
    return [(col - (cols - 1) / 2) * (ROOM_W + GAP), row === 0 ? -(ROOM_D / 2 + 0.25) : ROOM_D / 2 + 0.25]
  })
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
      camera={{ position: [7, 6, 9], fov: 42 }}
      onPointerMissed={() => onSelect(null)}
      style={{ touchAction: 'none' }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[6, 10, 5]} intensity={1.6} />
      <directionalLight position={[-6, 4, -6]} intensity={0.5} />

      <group>
        {visibleFloors.map((floor) => {
          const level = onlyFloor ? 0 : FLOORS.indexOf(floor)
          const floorCells = cells.filter((c) => c.floor === floor)
          const positions = layout(floorCells.length)
          return (
            <group key={floor} position={[0, level * FLOOR_HEIGHT, 0]}>
              {/* Losa del piso */}
              <mesh position={[0, -0.45, 0]}>
                <boxGeometry args={[8.6, 0.12, 3.9]} />
                <meshStandardMaterial color={floor === 'terraza' ? '#a7f3d0' : '#cbd5e1'} />
              </mesh>
              {floorCells.map((cell, i) => {
                const [x, z] = positions[i]
                const selected = cell.key === selectedKey
                return (
                  <mesh
                    key={cell.key}
                    position={[x, 0, z]}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(cell.key)
                    }}
                    scale={selected ? [1.04, 1.12, 1.04] : [1, 1, 1]}
                  >
                    <boxGeometry args={[ROOM_W, 0.78, ROOM_D]} />
                    <meshStandardMaterial
                      color={cell.color}
                      transparent={cell.vacant}
                      opacity={cell.vacant ? 0.3 : 1}
                      emissive={selected ? '#ffffff' : '#000000'}
                      emissiveIntensity={selected ? 0.35 : 0}
                    />
                    <Edges color={selected ? '#0f172a' : '#475569'} lineWidth={selected ? 2 : 1} />
                  </mesh>
                )
              })}
            </group>
          )
        })}
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, onlyFloor ? 0 : 2, 0]}
        makeDefault
      />
    </Canvas>
  )
}
