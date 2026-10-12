import { Home, PackageSearch, ShieldCheck, User, Wallet, WashingMachine } from 'lucide-react'

export type AppTab = 'home' | 'booking' | 'lostfound' | 'owner' | 'rent' | 'profile'

interface BottomNavigationProps {
  tab: AppTab
  onChange: (tab: AppTab) => void
  showOwnerTab: boolean
}

type NavItem = { id: AppTab; label: string; icon: typeof Home }

const HOME: NavItem = { id: 'home', label: 'Inicio', icon: Home }
const BOOKING: NavItem = { id: 'booking', label: 'Reservar', icon: WashingMachine }
const RENT: NavItem = { id: 'rent', label: 'Pagos', icon: Wallet }
const LOST_FOUND: NavItem = { id: 'lostfound', label: 'Objetos', icon: PackageSearch }
const OWNER: NavItem = { id: 'owner', label: 'Panel', icon: ShieldCheck }
const PROFILE: NavItem = { id: 'profile', label: 'Perfil', icon: User }

// La dueña gestiona los cobros desde su Panel; los inquilinos tienen su pestaña Pagos.
const TENANT_ITEMS = [HOME, BOOKING, RENT, LOST_FOUND, PROFILE]
const OWNER_ITEMS = [HOME, BOOKING, LOST_FOUND, OWNER, PROFILE]

export function BottomNavigation({ tab, onChange, showOwnerTab }: BottomNavigationProps) {
  const items = showOwnerTab ? OWNER_ITEMS : TENANT_ITEMS

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
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
