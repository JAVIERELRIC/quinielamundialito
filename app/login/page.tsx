'use client'
import { Suspense, useState, useEffect } from 'react' // 🔥 Agregamos useEffect aquí
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const verificar = searchParams.get('verificar')

  // ==========================================
  // 🚀 REDIRECCIÓN AUTOMÁTICA SI YA HAY SESIÓN
  // ==========================================
  useEffect(() => {
    // Si el usuario ya inició sesión previamente, mándalo directo a la quiniela
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/quiniela')
      }
    })

    // Si detecta que inicia sesión exitosamente tras meter el código, redirige de inmediato
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/quiniela')
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // ==========================================
  // PASO 1: Enviar el código al correo
  // ==========================================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `https://project-8vezg.vercel.app/auth/callback` },
    })
    if (error) {
      setError('No se pudo enviar el correo. Verifica que estés registrado.')
    } else {
      setEnviado(true)
    }
    setLoading(false)
  }

  // ==========================================
  // PASO 2: Verificar el código numérico (OTP)
  // ==========================================
  async function handleVerifyToken(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'magiclink',
    })

    if (error) {
      setError('Código incorrecto o expirado. Verifica tu bandeja e intenta de nuevo.')
      setLoading(false)
    }
    // Nota: El redireccionamiento lo maneja automáticamente el useEffect de arriba al detectar la sesión
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        
        {/* Encabezado */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-2xl font-semibold text-gray-900">Quiniela Mundial 2026</h1>
          <p className="text-gray-500 text-sm mt-1">
            {enviado || verificar ? 'Ingresa tu token de seguridad' : 'Ingresa con tu correo'}
          </p>
        </div>

        {/* CONTENEDOR DINÁMICO */}
        {!(enviado || verificar) ? (
          /* PASO 1: CAPTURA DEL EMAIL */
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
            />
            {error && <p className="text-red-500 text-xs mb-3 text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
              style={{ background: loading ? '#9FE1CB' : '#1D9E75' }}
            >
              {loading ? 'Enviando...' : 'Enviar link de acceso →'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Solo funciona si ya fuiste invitado
            </p>
          </form>
        ) : (
          /* PASO 2: INPUT NUMÉRICO */
          <form onSubmit={handleVerifyToken} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">📩</div>
              <p className="font-medium text-green-800 text-sm">¡Revisa tu correo!</p>
              <p className="text-green-700 text-xs mt-0.5">
                Te enviamos un código de acceso para entrar. Puede tardar 1-2 minutos.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 text-center">
                Escribe tu código de acceso
              </label>
              <input
                required
                type="text"
                maxLength={8}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="000000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base text-center font-mono font-bold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60"
            >
              {loading ? 'Verificando...' : '🚀 Entrar a la Quiniela'}
            </button>

            <button
              type="button"
              onClick={() => { setEnviado(false); setToken(''); setError(''); }}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1 block"
            >
              ← Cambiar o reescribir correo
            </button>
          </form>
        )}

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  )
}