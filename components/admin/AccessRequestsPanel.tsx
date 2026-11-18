'use client'

import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

type AccessRequest = {
  id: string
  nombre: string
  email: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  created_at: string
  updated_at: string
}

type ApiError = {
  error?: string
  message?: string
}

export default function AccessRequestsPanel() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const authenticatedFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.')
      }

      return fetch(url, {
        ...init,
        cache: 'no-store',
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
    },
    [],
  )

  const loadRequests = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true)

      try {
        const response = await authenticatedFetch(
          '/api/access-requests?estado=pendiente',
        )
        const payload = (await response.json()) as {
          solicitudes?: AccessRequest[]
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error || 'No se pudieron cargar las solicitudes.')
        }

        setRequests(payload.solicitudes ?? [])
        setError('')
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudieron cargar las solicitudes.',
        )
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [authenticatedFetch],
  )

  useEffect(() => {
    void loadRequests(true)

    const interval = window.setInterval(() => {
      void loadRequests(false)
    }, 20_000)

    return () => window.clearInterval(interval)
  }, [loadRequests])

  async function handleAction(
    accessRequest: AccessRequest,
    action: 'approve' | 'reject',
  ) {
    const verb = action === 'approve' ? 'aprobar' : 'rechazar'

    if (
      !window.confirm(
        `¿Quieres ${verb} la solicitud de ${accessRequest.nombre} (${accessRequest.email})?`,
      )
    ) {
      return
    }

    setWorkingId(accessRequest.id)
    setError('')
    setNotice('')

    try {
      const response = await authenticatedFetch(
        `/api/access-requests/${accessRequest.id}/${action}`,
        { method: 'POST', body: '{}' },
      )
      const payload = (await response.json()) as ApiError

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo atender la solicitud.')
      }

      setRequests(current =>
        current.filter(item => item.id !== accessRequest.id),
      )
      setNotice(payload.message || 'Solicitud actualizada.')
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'No se pudo atender la solicitud.',
      )
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              Solicitudes de acceso
            </h2>
            {requests.length > 0 && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                {requests.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Se actualiza automáticamente cada 20 segundos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRequests(true)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-gray-500">Cargando solicitudes…</p>
      ) : requests.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No hay solicitudes pendientes.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(item => {
                const busy = workingId === item.id

                return (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                      {item.nombre}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {item.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {new Intl.DateTimeFormat('es-MX', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.created_at))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={workingId !== null}
                          onClick={() => void handleAction(item, 'reject')}
                          className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={workingId !== null}
                          onClick={() => void handleAction(item, 'approve')}
                          className="rounded-lg bg-green-600 px-3 py-2 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? 'Procesando…' : 'Aprobar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
