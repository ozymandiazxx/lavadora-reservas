import { Home, PackageSearch, ShieldCheck, User, WashingMachine } from 'lucide-react'

export type AppTab = 'home' | 'booking' | 'lostfound' | 'owner' | 'profile'

interface BottomNavigationProps {
  tab: AppTab
  onChange: (tab: AppTab) => void
  showOwnerTab: boolean
}

const BASE_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'booking', label: 'Reservar', icon: WashingMachine },
  { id: 'lostfound', label: 'Objetos', icon: PackageSearch },
  { id: 'profile', label: 'Perfil', icon: User },
]

export function BottomNavigation({ tab, onChange, showOwnerTab }: BottomNavigationProps) {
  const items = showOwnerTab
    ? [...BASE_ITEMS.slice(0, 3), { id: 'owner' as const, label: 'Panel', icon: ShieldCheck }, BASE_ITEMS[3]]
    : BASE_ITEMS

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className={`mx-auto grid max-w-lg ${items.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {items.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="flex flex-col items-center gap-0.5 py-2.5 transition"
            >
              <Icon
                className={`size-6 transition ${active ? 'text-teal-600' : 'text-slate-400'}`}
                strokeWidth={active ? 2.4 : 2}
              />
              <span className={`text-[11px] font-semibold ${active ? 'text-teal-700' : 'text-slate-400'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
