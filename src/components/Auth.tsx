import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, WashingMachine } from 'lucide-react'
import { roomNumberToLoginEmail, translateAuthError } from '@/lib/auth'
import { FLOOR_LABEL, FLOORS, roomTypeForFloor } from '@/lib/rooms'
import { supabase } from '@/lib/supabase'
import type { Floor } from '@/lib/types'

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

export function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [password, setPassword] = useState('')
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
      const email = roomNumberToLoginEmail(roomNumber)
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 via-slate-100 to-slate-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
            <WashingMachine className="size-6" strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Reserva de lavadora</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? 'Inicia sesión con tu habitación para reservar tu turno.' : 'Creá tu cuenta de inquilino.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="room-number" className={labelClass}>
              N.º de habitación
            </label>
            <input
              id="room-number"
              type="text"
              required
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="Ej: 5B"
              className={inputClass}
            />
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
                    className={inputClass}
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
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="floor" className={labelClass}>
                  Piso
                </label>
                <select
                  id="floor"
                  required
                  value={floor}
                  onChange={(e) => setFloor(e.target.value as Floor)}
                  className={inputClass}
                >
                  {FLOORS.map((f) => (
                    <option key={f} value={f}>
                      {FLOOR_LABEL[f]}
                    </option>
                  ))}
                </select>
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
                  className={inputClass}
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
              {error}
            </p>
          )}
          {info && (
            <p className="flex items-start gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Cargando…' : mode === 'login' ? 'Iniciar sesión' : 'Registrarme'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
            setInfo(null)
          }}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-800"
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  )
}
