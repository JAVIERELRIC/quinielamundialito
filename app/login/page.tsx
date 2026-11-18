'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

type Screen = 'login' | 'request'

export default function LoginPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function resetMessages() {
    setError('')
    setMessage('')
  }

  function changeScreen(next: Screen) {
    setScreen(next)
    setCode('')
    setCodeSent(false)
    resetMessages()
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      })

      if (otpError) {
        throw otpError
      }

      setEmail(normalizedEmail)
      setCodeSent(true)
      setMessage('Te enviamos un código de acceso. Revisa también correo no deseado.')
    } catch {
      setError(
        'No pudimos enviar el código. Si aún no tienes acceso, envía una solicitud al administrador.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    resetMessages()

    const cleanCode = code.replace(/\D/g, '')

    if (cleanCode.length !== 6) {
      setError('El código debe tener 6 dígitos.')
      return
    }

    setLoading(true)

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleanCode,
        type: 'email',
      })

      if (verifyError || !data.user) {
        throw verifyError ?? new Error('No se pudo validar el código.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, activo')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError || !profile || profile.activo === false) {
        await supabase.auth.signOut()
        setCode('')
        setCodeSent(false)
        setError('Tu acceso todavía no ha sido aprobado por el administrador.')
        return
      }

      router.replace('/quiniela')
      router.refresh()
    } catch {
      setError('El código no es válido o ya venció. Solicita uno nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function requestAccess(event: FormEvent) {
    event.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      const response = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: name.trim(),
          email: email.trim().toLowerCase(),
          website: '',
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || 'No fue posible enviar la solicitud.')
      }

      setMessage(
        payload.message ||
          'Solicitud recibida. Te avisaremos por correo cuando sea aprobada.',
      )
      setName('')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No fue posible enviar la solicitud.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="bg-gray-950 px-6 py-7 text-center text-white">
            <div className="text-4xl" aria-hidden="true">
              ⚽
            </div>
            <h1 className="mt-2 text-2xl font-black">Quiniela de la Liguilla</h1>
            <p className="mt-1 text-sm text-gray-300">
              Acceso exclusivo para participantes aprobados
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => changeScreen('login')}
                className={`rounded-lg px-3 py-2 transition ${
                  screen === 'login'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Ya tengo acceso
              </button>
              <button
                type="button"
                onClick={() => changeScreen('request')}
                className={`rounded-lg px-3 py-2 transition ${
                  screen === 'request'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Solicitar acceso
              </button>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {message}
              </div>
            )}

            {screen === 'login' ? (
              !codeSent ? (
                <form onSubmit={sendCode} className="mt-6 space-y-5">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-sm font-semibold text-gray-700"
                    >
                      Correo electrónico
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      placeholder="tu@correo.com"
                      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Enviando…' : 'Enviar código'}
                  </button>
                </form>
              ) : (
                <form onSubmit={verifyCode} className="mt-6 space-y-5">
                  <div>
                    <label
                      htmlFor="otp-code"
                      className="block text-sm font-semibold text-gray-700"
                    >
                      Código de 6 dígitos
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={event =>
                        setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="000000"
                      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.45em] outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Validando…' : 'Entrar'}
                  </button>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setCode('')
                        setCodeSent(false)
                        resetMessages()
                      }}
                      className="font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Cambiar correo
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void sendCode()}
                      className="font-semibold text-green-700 hover:text-green-900 disabled:opacity-50"
                    >
                      Reenviar código
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={requestAccess} className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="request-name"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Nombre
                  </label>
                  <input
                    id="request-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Tu nombre"
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="request-email"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="request-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="tu@correo.com"
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Enviando…' : 'Solicitar acceso'}
                </button>

                <p className="text-center text-xs leading-5 text-gray-500">
                  La solicitud no crea una cuenta. Solo podrás entrar cuando un
                  administrador la apruebe.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
