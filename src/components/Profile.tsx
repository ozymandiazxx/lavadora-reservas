import { useState, type FormEvent } from 'react'
import { AlertCircle, CalendarCheck2, CheckCircle2, ChevronRight, KeyRound, LogOut } from 'lucide-react'
import { isDemoMode } from '@/lib/db'
import { FLOOR_LABEL } from '@/lib/rooms'
import { supabase } from '@/lib/supabase'
import type { Profile as ProfileType } from '@/lib/types'
import type { AppTab } from './BottomNavigation'

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

const ROOM_TYPE_LABEL: Record<string, string> = { normal: 'Normal', suite: 'Suite' }

export function Profile({ profile, onNavigate }: { profile: ProfileType; onNavigate: (tab: AppTab) => void }) {
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    setSaving(true)
    const { error } = await supabase!.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
      return
    }
    setPasswordMsg({ type: 'success', text: 'Contraseña actualizada.' })
    setNewPassword('')
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-5 pb-28">
      <div className="flex flex-col items-center rounded-3xl bg-white p-6 text-center shadow-sm shadow-slate-900/5">
        <div className="flex size-20 items-center justify-center rounded-full bg-teal-100 text-2xl font-extrabold text-teal-700">
          {initialsOf(profile.first_name, profile.last_name)}
        </div>
        <p className="mt-3 text-xl font-extrabold text-slate-900">
          {profile.first_name} {profile.last_name}
        </p>
        <p className="text-sm text-slate-500">
          {FLOOR_LABEL[profile.floor]} · Habitación {profile.room_number}
        </p>
        <span className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
          {ROOM_TYPE_LABEL[profile.room_type]}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-900/5">
        <button
          type="button"
          onClick={() => onNavigate('booking')}
          className="flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left"
        >
          <CalendarCheck2 className="size-5 text-slate-400" strokeWidth={2} />
          <span className="flex-1 font-semibold text-slate-700">Mis reservas</span>
          <ChevronRight className="size-4 text-slate-300" strokeWidth={2.2} />
        </button>

        <button
          type="button"
          onClick={() => {
            setChangingPassword((v) => !v)
            setPasswordMsg(null)
          }}
          disabled={isDemoMode}
          className="flex w-full items-center gap-3 p-4 text-left disabled:opacity-40"
        >
          <KeyRound className="size-5 text-slate-400" strokeWidth={2} />
          <span className="flex-1 font-semibold text-slate-700">Cambiar contraseña</span>
          <ChevronRight className={`size-4 text-slate-300 transition ${changingPassword ? 'rotate-90' : ''}`} strokeWidth={2.2} />
        </button>

        {changingPassword && (
          <form onSubmit={handleChangePassword} className="space-y-3 border-t border-slate-100 p-4">
            <input
              type="password"
              required
              minLength={6}
              placeholder="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            {passwordMsg && (
              <p
                className={`flex items-center gap-1.5 text-sm ${passwordMsg.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {passwordMsg.type === 'error' ? (
                  <AlertCircle className="size-4 shrink-0" strokeWidth={2.2} />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0" strokeWidth={2.2} />
                )}
                {passwordMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>

      {!isDemoMode && (
        <button
          type="button"
          onClick={() => supabase!.auth.signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white p-4 font-bold text-red-600 shadow-sm shadow-slate-900/5"
        >
          <LogOut className="size-4" strokeWidth={2.2} />
          Cerrar sesión
        </button>
      )}
    </div>
  )
}
