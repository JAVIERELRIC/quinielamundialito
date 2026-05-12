'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const verificar = searchParams.get('verificar')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await signIn('email', { email, callbackUrl: '/quiniela' })
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-2xl font-semibold text-gray-900">Quiniela Mundial 2026</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresa con tu correo</p>
        </div>

        {verificar ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <div className="text-3xl mb-2">📧</div>
            <p className="font-medium text-green-800">¡Revisa tu correo!</p>
            <p className="text-green-700 text-sm mt-1">
              Te enviamos un link para entrar. Puede tardarse 1-2 minutos.
            </p>
          </div>
        ) : (
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
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-verde text-white font-medium py-2.5 rounded-lg hover:bg-verde-dark transition-colors disabled:opacity-60 text-sm"
              style={{ background: loading ? '#9FE1CB' : '#1D9E75' }}
            >
              {loading ? 'Enviando...' : 'Enviar link de acceso →'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Solo funciona si ya fuiste invitado
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
