import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Auth } from '@/components/Auth'
import { BottomNavigation, type AppTab } from '@/components/BottomNavigation'
import { DemoBanner } from '@/components/DemoBanner'
import { Home } from '@/components/Home'
import { LaundryBooking } from '@/components/LaundryBooking'
import { LostFound } from '@/components/LostFound'
import { OwnerView } from '@/components/OwnerView'
import { Profile } from '@/components/Profile'
import { DEMO_TENANT_ID, fetchProfile, isDemoMode, setDemoOwner } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { Profile as ProfileType } from '@/lib/types'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(!isDemoMode)
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [tab, setTab] = useState<AppTab>('home')

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
    setTab(next ? 'owner' : 'home')
  }

  if (!isDemoMode && sessionLoading) {
    return <div className="flex min-h-dvh items-center justify-center bg-cream text-slate-500">Cargando…</div>
  }

  if (!isDemoMode && !session) {
    return <Auth />
  }

  return (
    <div className="min-h-dvh bg-cream">
      {isDemoMode && profile && <DemoBanner isOwner={profile.is_owner} onToggleOwner={toggleDemoOwner} />}

      <main>
        {!userId || !profile ? (
          <div className="p-8 text-center text-slate-500">Cargando perfil…</div>
        ) : tab === 'owner' && profile.is_owner ? (
          <OwnerView />
        ) : tab === 'lostfound' ? (
          <LostFound userId={userId} isOwner={profile.is_owner} />
        ) : tab === 'profile' ? (
          <Profile profile={profile} onNavigate={setTab} />
        ) : tab === 'booking' ? (
          <LaundryBooking userId={userId} />
        ) : (
          <Home userId={userId} profile={profile} onNavigate={setTab} />
        )}
      </main>

      {profile && <BottomNavigation tab={tab} onChange={setTab} showOwnerTab={profile.is_owner} />}
    </div>
  )
}

export default App
