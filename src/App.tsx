import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LogOut, PackageSearch, ShieldCheck, WashingMachine } from 'lucide-react'
import { Auth } from '@/components/Auth'
import { DemoBanner } from '@/components/DemoBanner'
import { LaundryBooking } from '@/components/LaundryBooking'
import { LostFound } from '@/components/LostFound'
import { OwnerView } from '@/components/OwnerView'
import { DEMO_TENANT_ID, fetchProfile, isDemoMode, setDemoOwner } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

type Tab = 'booking' | 'lostfound' | 'owner'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(!isDemoMode)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('booking')

  useEffect(() => {
    if (isDemoMode) return
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: subscription } = supabase!.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const userId = isDemoMode ? DEMO_TENANT_ID : (session?.user.id ?? null)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    fetchProfile(userId).then(({ data }) => setProfile(data))
  }, [userId, session])

  function toggleDemoOwner() {
    if (!profile) return
    const next = !profile.is_owner
    setDemoOwner(next)
    setProfile({ ...profile, is_owner: next })
    setTab(next ? 'owner' : 'booking')
  }

  if (!isDemoMode && sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">Cargando…</div>
    )
  }

  if (!isDemoMode && !session) {
    return <Auth />
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof WashingMachine; show: boolean }> = [
    { id: 'booking', label: 'Reservar', icon: WashingMachine, show: true },
    { id: 'lostfound', label: 'Objetos perdidos', icon: PackageSearch, show: true },
    { id: 'owner', label: 'Panel de la dueña', icon: ShieldCheck, show: !!profile?.is_owner },
  ]

  return (
    <div className="min-h-screen bg-slate-100">
      {isDemoMode && profile && <DemoBanner isOwner={profile.is_owner} onToggleOwner={toggleDemoOwner} />}

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
              <WashingMachine className="size-5" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold text-slate-900">Reserva de lavadora</h1>
              <p className="text-xs text-slate-500">Coordiná tu turno sin cruzarte con nadie</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile && (
              <nav className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
                {tabs
                  .filter((t) => t.show)
                  .map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
                        tab === id
                          ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-900/5'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="size-4" strokeWidth={2.2} />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
              </nav>
            )}
            {!isDemoMode && (
              <button
                type="button"
                onClick={() => supabase!.auth.signOut()}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Cerrar sesión"
              >
                <LogOut className="size-4" strokeWidth={2.2} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {!userId || !profile ? (
          <div className="p-8 text-center text-slate-500">Cargando perfil…</div>
        ) : tab === 'owner' && profile.is_owner ? (
          <OwnerView />
        ) : tab === 'lostfound' ? (
          <LostFound userId={userId} isOwner={profile.is_owner} />
        ) : (
          <LaundryBooking userId={userId} />
        )}
      </main>
    </div>
  )
}

export default App
