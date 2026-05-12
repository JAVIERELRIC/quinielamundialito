'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DevLogin() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleToken(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink',
    })
    if (error) {
      setError(error.message)
    } else {
      router.push('/quiniela')
    }
    setLoading(false)
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: 'javier.tolk@gmail.com',
      options: { emailRedirectTo: 'https://project-8vezg.vercel.app/auth/callback' }
    })
    if (error) setError(error.message)
    else setError('✅ Revisa tu Gmail — llega en 1 min')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">⚽</div>
          <h1 className="text-xl font-semibold">Acceso directo</h1>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 mb-3">Paso 1 — Pide el magic link a tu Gmail:</p>
          <button onClick={sendOtp} disabled={loading}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {loading ? 'Enviando...' : 'Enviar magic link a javier.tolk@gmail.com'}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-600 mb-3">Paso 2 — Cuando llegue el email, copia el <code>token</code> del link y pégalo aquí:</p>
          <p className="text-xs text-gray-400 mb-2">El link se ve así: ...verify?token=<strong>ESTE_TEXTO</strong>&type=magiclink...</p>
          <form onSubmit={handleToken} className="space-y-2">
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="Pega el token aquí"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={loading || !token}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              Entrar con token
            </button>
          </form>
        </div>
        {error && <p className="text-sm text-center" style={{color: error.startsWith('✅') ? 'green' : 'red'}}>{error}</p>}
      </div>
    </div>
  )
}
