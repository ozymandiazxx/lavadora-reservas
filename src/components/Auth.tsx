import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, DoorOpen, Eye, EyeOff, Home, Lock } from 'lucide-react'
import { loginEmailFor, translateAuthError } from '@/lib/auth'
import { FLOOR_LABEL, FLOORS, roomTypeForFloor } from '@/lib/rooms'
import { supabase } from '@/lib/supabase'
import type { Floor } from '@/lib/types'
import { LaundryIllustration } from './LaundryIllustration'

const labelClass = 'mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500'

export function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [floor, setFloor] = useState<Floor>('piso_2')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const email = loginEmailFor(floor, roomNumber)
      if (mode === 'login') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) setError(translateAuthError(error.message))
      } else {
        const { error } = await supabase!.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              room_number: roomNumber,
              room_type: roomTypeForFloor(floor),
              floor,
              phone,
            },
          },
        })
        if (error) setError(translateAuthError(error.message))
        else setInfo('Cuenta creada. Ya podés iniciar sesión.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream px-5 pt-10 pb-10">
      <div className="mx-auto max-w-sm">
        <LaundryIllustration />

        <h1 className="mt-6 text-center text-2xl font-extrabold text-slate-900">Reserva de lavadora</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Organizá tu turno sin cruzarte con nadie</p>

        <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-900/5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="floor" className={labelClass}>
                  <Home className="size-3.5" strokeWidth={2.2} />
                  Piso
                </label>
                <div className="relative">
                  <select
                    id="floor"
                    required
                    value={floor}
                    onChange={(e) => setFloor(e.target.value as Floor)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                  >
                    {FLOORS.map((f) => (
                      <option key={f} value={f}>
                        {FLOOR_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="room-number" className={labelClass}>
                  <DoorOpen className="size-3.5" strokeWidth={2.2} />
                  Habitación
                </label>
                <input
                  id="room-number"
                  type="text"
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Ej: 5"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="first-name" className={labelClass}>
                      Nombre
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="last-name" className={labelClass}>
                      Apellido
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Teléfono de contacto
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="11-5555-0100"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className={labelClass}>
                <Lock className="size-3.5" strokeWidth={2.2} />
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-10 pl-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <p className="text-xs text-slate-400">
                El número de habitación se repite entre pisos, por eso pedimos los dos.
              </p>
            )}

            {error && (
              <p className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
                {error}
              </p>
            )}
            {info && (
              <p className="flex items-start gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-600 px-3 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Cargando…' : mode === 'login' ? 'Ingresar' : 'Registrarme'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
              setInfo(null)
            }}
            className="mt-4 w-full text-center text-sm font-medium text-slate-500 hover:text-teal-700"
          >
            {mode === 'login' ? '¿No tienes cuenta? Registrate' : '¿Ya tienes cuenta? Iniciá sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}
