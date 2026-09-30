import { useRef, useState } from 'react'

export interface TrendPoint {
  /** Etiqueta corta para el eje X, ej. "Lun 29" o "Sem. 39". */
  label: string
  hours: number
}

const WIDTH = 320
const HEIGHT = 120
const PAD_LEFT = 28
const PAD_RIGHT = 8
const PAD_TOP = 10
const PAD_BOTTOM = 20

export function UsageTrendChart({ points }: { points: TrendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (points.length === 0) return null

  const maxHours = Math.max(...points.map((p) => p.hours), 1)
  const niceMax = Math.ceil(maxHours / 2) * 2 || 2
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM

  const xFor = (i: number) => PAD_LEFT + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth)
  const yFor = (hours: number) => PAD_TOP + plotHeight - (hours / niceMax) * plotHeight

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.hours)}`).join(' ')
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${PAD_TOP + plotHeight} L ${xFor(0)} ${PAD_TOP + plotHeight} Z`

  function handlePointer(clientX: number) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * WIDTH
    let nearest = 0
    let best = Infinity
    points.forEach((_, i) => {
      const d = Math.abs(xFor(i) - relX)
      if (d < best) {
        best = d
        nearest = i
      }
    })
    setHoverIndex(nearest)
  }

  const hover = hoverIndex !== null ? points[hoverIndex] : null
  const hoverX = hoverIndex !== null ? xFor(hoverIndex) : 0
  const hoverY = hoverIndex !== null ? yFor(points[hoverIndex].hours) : 0
  const gridSteps = [0, niceMax / 2, niceMax]

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={(e) => handlePointer(e.clientX)}
        onPointerDown={(e) => handlePointer(e.clientX)}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {gridSteps.map((g) => (
          <g key={g}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(g)} y2={yFor(g)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={0} y={yFor(g) + 3} fontSize={8} fill="#898781">
              {g}h
            </text>
          </g>
        ))}

        <path d={areaPath} fill="#0d9488" opacity={0.1} />
        <path d={linePath} fill="none" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.length <= 14 &&
          points.map((_, i) => (
            <circle key={i} cx={xFor(i)} cy={yFor(points[i].hours)} r={2.5} fill="#0d9488" />
          ))}

        {hover && (
          <>
            <line x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={PAD_TOP + plotHeight} stroke="#c3c2b7" strokeWidth={1} />
            <circle cx={hoverX} cy={hoverY} r={4} fill="#0d9488" stroke="#fff" strokeWidth={2} />
          </>
        )}

        {/* etiquetas del eje X: primera, última, y la del hover */}
        <text x={xFor(0)} y={HEIGHT - 4} fontSize={8} fill="#898781" textAnchor="start">
          {points[0].label}
        </text>
        <text x={xFor(points.length - 1)} y={HEIGHT - 4} fontSize={8} fill="#898781" textAnchor="end">
          {points[points.length - 1].label}
        </text>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-center text-white shadow-lg"
          style={{ left: `${(hoverX / WIDTH) * 100}%` }}
        >
          <p className="text-xs font-bold">{hover.hours} h</p>
          <p className="text-[10px] text-slate-300">{hover.label}</p>
        </div>
      )}
    </div>
  )
}
