import { Html } from '@react-three/drei'
import type { Floor } from '@/lib/types'

// Colores tomados de la foto de la fachada.
const CREAM = '#fbf1de'
const RED = '#b8322a'
const ORANGE = '#ee8a2b'
const GLASS = '#2a3240'
const GREEN = '#2f9e44'
const PIPE = '#8a8f98'

const W = 14 // ancho de la fachada
const DEPTH = 6
const FLOOR_H = 2.7
const BASE_H = 3 // planta baja (locales comerciales)

/** Ventanas del frente de un piso, medidas sobre la foto: [x, ancho, tipo]. */
const WINDOWS: Array<[number, number, 'orange' | 'red']> = [
  [-5.6, 1.7, 'orange'],
  [-2.7, 2.9, 'red'],
  [1.1, 2.7, 'red'],
  [4.4, 2.3, 'red'],
  [6.3, 0.9, 'orange'],
]

function WindowRow({ y }: { y: number }) {
  return (
    <group position={[0, y, DEPTH / 2]}>
      {WINDOWS.map(([x, w, trim], i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[w, 0.95, 0.06]} />
            <meshStandardMaterial color={GLASS} />
          </mesh>
          <mesh position={[0, -0.62, 0.08]}>
            <boxGeometry args={[w + 0.12, 0.3, 0.14]} />
            <meshStandardMaterial color={trim === 'orange' ? ORANGE : RED} />
          </mesh>
          {trim === 'orange' && (
            <mesh position={[0, 0.62, 0.05]}>
              <boxGeometry args={[w + 0.12, 0.2, 0.1]} />
              <meshStandardMaterial color={RED} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

function GroundFloor() {
  return (
    <group>
      <mesh position={[0, BASE_H / 2, 0]}>
        <boxGeometry args={[W, BASE_H, DEPTH]} />
        <meshStandardMaterial color={CREAM} />
      </mesh>
      {/* Puerta de acceso con reja, cortinas metálicas de los locales y toldo verde */}
      {(
        [
          [-5.6, 1.7, RED],
          [-2.5, 3.3, '#c0392b'],
          [1.0, 2.7, '#c0392b'],
        ] as const
      ).map(([x, w, color], i) => (
        <mesh key={i} position={[x, 1.2, DEPTH / 2 + 0.04]}>
          <boxGeometry args={[w, 2.4, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[4.4, 2.5, DEPTH / 2 + 0.6]}>
        <boxGeometry args={[3.6, 0.12, 1.3]} />
        <meshStandardMaterial color={GREEN} />
      </mesh>
      <mesh position={[4.4, 1.0, DEPTH / 2 - 0.4]}>
        <boxGeometry args={[3.4, 2.0, 0.1]} />
        <meshStandardMaterial color="#5c3d2e" />
      </mesh>
    </group>
  )
}

interface FloorBlockProps {
  floor: Floor
  y: number
  size: [number, number, number]
  x?: number
  windows?: boolean
  selected: boolean
  onPick: (floor: Floor) => void
}

function FloorBlock({ floor, y, size, x = 0, windows = false, selected, onPick }: FloorBlockProps) {
  return (
    <group position={[x, 0, 0]}>
      <mesh
        position={[0, y, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onPick(floor)
        }}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial color={CREAM} emissive={selected ? '#ffffff' : '#000000'} emissiveIntensity={selected ? 0.25 : 0} />
      </mesh>
      {windows && <WindowRow y={y + 0.15} />}
      {/* Franja roja entre pisos */}
      <mesh position={[0, y - size[1] / 2, 0]}>
        <boxGeometry args={[size[0] + 0.12, 0.28, size[2] + 0.12]} />
        <meshStandardMaterial color={RED} />
      </mesh>
    </group>
  )
}

export interface FacadeProps {
  /** Texto corto sobre cada piso (ej: "2 vencidos"). */
  badges: Partial<Record<Floor, string>>
  onPick: (floor: Floor) => void
}

export function Facade({ badges, onPick }: FacadeProps) {
  const p2Y = BASE_H + FLOOR_H / 2
  const p3Y = BASE_H + FLOOR_H * 1.5
  const roofY = BASE_H + FLOOR_H * 2

  return (
    <group position={[0, 0, 0]}>
      {/* Calle y vereda */}
      <mesh position={[0, -0.06, 5]}>
        <boxGeometry args={[40, 0.1, 18]} />
        <meshStandardMaterial color="#6b6f76" />
      </mesh>
      <mesh position={[0, 0.0, DEPTH / 2 + 0.9]}>
        <boxGeometry args={[W + 2, 0.12, 1.8]} />
        <meshStandardMaterial color="#cfcac0" />
      </mesh>

      <GroundFloor />

      <FloorBlock floor="piso_2" y={p2Y} size={[W, FLOOR_H, DEPTH]} windows selected={false} onPick={onPick} />
      <FloorBlock floor="piso_3" y={p3Y} size={[W, FLOOR_H, DEPTH]} windows selected={false} onPick={onPick} />

      {/* Parapeto rojo del techo */}
      <mesh position={[0, roofY + 0.2, DEPTH / 2]}>
        <boxGeometry args={[W + 0.2, 0.5, 0.2]} />
        <meshStandardMaterial color={RED} />
      </mesh>
      <mesh position={[-W / 2, roofY + 0.2, 0]}>
        <boxGeometry args={[0.2, 0.5, DEPTH]} />
        <meshStandardMaterial color={RED} />
      </mesh>
      <mesh position={[W / 2, roofY + 0.2, 0]}>
        <boxGeometry args={[0.2, 0.5, DEPTH]} />
        <meshStandardMaterial color={RED} />
      </mesh>

      {/* Terraza: volumen pequeño sobre el techo, al lado derecho */}
      <FloorBlock floor="terraza" y={roofY + 1.2} x={4.2} size={[4.4, 2.4, 3.6]} selected={false} onPick={onPick} />
      <mesh position={[4.2 + 0.0, roofY + 1.3, 3.6 / 2 + 0.03]}>
        <boxGeometry args={[3.2, 0.9, 0.06]} />
        <meshStandardMaterial color={GLASS} />
      </mesh>

      {/* Tubo vertical de la fachada */}
      <mesh position={[1.9, (BASE_H + FLOOR_H * 2) / 2, DEPTH / 2 + 0.15]}>
        <cylinderGeometry args={[0.1, 0.1, BASE_H + FLOOR_H * 2, 12]} />
        <meshStandardMaterial color={PIPE} />
      </mesh>

      {/* Etiquetas */}
      <Html position={[-W / 2 - 0.9, 1.5, DEPTH / 2]} center style={{ pointerEvents: 'none' }}>
        <Chip text="Locales comerciales" muted />
      </Html>
      <Html position={[-W / 2 - 0.9, p2Y, DEPTH / 2]} center style={{ pointerEvents: 'none' }}>
        <Chip text={`Piso 2${badges.piso_2 ? ` · ${badges.piso_2}` : ''}`} />
      </Html>
      <Html position={[-W / 2 - 0.9, p3Y, DEPTH / 2]} center style={{ pointerEvents: 'none' }}>
        <Chip text={`Piso 3${badges.piso_3 ? ` · ${badges.piso_3}` : ''}`} />
      </Html>
      <Html position={[4.2, roofY + 2.9, 0]} center style={{ pointerEvents: 'none' }}>
        <Chip text={`Terraza${badges.terraza ? ` · ${badges.terraza}` : ''}`} />
      </Html>
    </group>
  )
}

function Chip({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-white ${muted ? 'bg-slate-500/80' : 'bg-slate-800/85'}`}
    >
      {text}
    </span>
  )
}
