import { ArrowLeftRight, FlaskConical } from 'lucide-react'

interface DemoBannerProps {
  isOwner: boolean
  onToggleOwner: () => void
}

export function DemoBanner({ isOwner, onToggleOwner }: DemoBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-400/90 px-4 py-2 text-sm text-amber-950">
      <span className="flex items-center gap-1.5">
        <FlaskConical className="size-4" strokeWidth={2.2} />
        <strong className="font-semibold">Modo demo</strong> — sin conexión a Supabase, los datos viven en memoria.
      </span>
      <button
        type="button"
        onClick={onToggleOwner}
        className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1 font-medium shadow-sm hover:bg-white"
      >
        <ArrowLeftRight className="size-3.5" strokeWidth={2.2} />
        Ver como {isOwner ? 'inquilino' : 'dueña'}
      </button>
    </div>
  )
}
