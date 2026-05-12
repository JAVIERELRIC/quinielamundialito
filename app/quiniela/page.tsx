'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MATCHES, GRUPOS, JORNADAS } from '@/lib/matches'

type Pick = 'A' | 'empate' | 'B'
type PicksMap = Record<number, Pick>
type ResultadosMap = Record<number, { goles_a: number; goles_b: number }>
type PosicionRow = { nombre: string; puntos_total: number; picks_correctos: number; picks_totales: number }

const TABS = ['picks', 'tabla', 'admin'] as const
type Tab = typeof TABS[number]

export default function QuinielaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('picks')
  const [jornadaActiva, setJornadaActiva] = useState(1)
  const [grupoActivo, setGrupoActivo] = useState<string>('todos')
  const [picks, setPicks] = useState<PicksMap>({})
  const [pendientes, setPendientes] = useState<Set<number>>(new Set())
  const [resultados, setResultados] = useState<ResultadosMap>({})
  const [posiciones, setPosiciones] = useState<PosicionRow[]>([])
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState('')
  const esAdmin = (session?.user as any)?.esAdmin

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/picks')
      .then(r => r.json())
      .then(({ picks: data }) => {
        const map: PicksMap = {}
        data?.forEach((p: any) => { map[p.partido_id] = p.pick })
        setPicks(map)
      })
    fetch('/api/results')
      .then(r => r.json())
      .then(({ resultados: data, posiciones: pos }) => {
        const map: ResultadosMap = {}
        data?.forEach((r: any) => { map[r.id] = { goles_a: r.goles_a, goles_b: r.goles_b } })
        setResultados(map)
        setPosiciones(pos || [])
      })
  }, [status])

  function setPick(partidoId: number, pick: Pick) {
    setPicks(prev => ({ ...prev, [partidoId]: pick }))
    setPendientes(prev => { const s = new Set(prev); s.add(partidoId); return s })
  }

  async function guardarPicks() {
    if (pendientes.size === 0) return
    setGuardando(true)
    const payload = Array.from(pendientes).map(id => ({ partido_id: id, pick: picks[id] })).filter(p => p.pick)
    const res = await fetch('/api/picks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks: payload }) })
    const data = await res.json()
    setGuardando(false)
    if (data.ok) {
      setPendientes(new Set())
      showToast(`✅ ${data.guardados} picks guardados`)
    } else {
      showToast('❌ ' + data.error)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const matchesFiltrados = MATCHES.filter(m => {
    const jornadaOk = m.jornada === jornadaActiva
    const grupoOk = grupoActivo === 'todos' || m.grupo === grupoActivo
    return jornadaOk && grupoOk
  })

  const totalPicks = MATCHES.length
  const llenados = Object.keys(picks).length
  const pct = Math.round((llenados / totalPicks) * 100)

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <span className="font-semibold text-gray-900 text-sm">Quiniela Mundial 2026</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{session?.user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs text-gray-400 hover:text-gray-600">Salir</button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-0">
          {(['picks', 'tabla', ...(esAdmin ? ['admin'] : [])] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'picks' ? '✏️ Mis picks' : t === 'tabla' ? '🏆 Tabla' : '⚙️ Admin'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">{toast}</div>
        )}

        {/* TAB: PICKS */}
        {tab === 'picks' && (
          <>
            {/* Progreso */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-600">Tu avance total</span>
                <span className="font-medium text-green-700">{llenados}/{totalPicks} ({pct}%)</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {pendientes.size > 0 && (
                <p className="text-xs text-amber-600 mt-1.5">⚠️ Tienes {pendientes.size} picks sin guardar</p>
              )}
            </div>

            {/* Filtros */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 shrink-0">
                {JORNADAS.map(j => (
                  <button key={j} onClick={() => setJornadaActiva(j)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${jornadaActiva === j ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    J{j}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
                <button onClick={() => setGrupoActivo('todos')}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${grupoActivo === 'todos' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  Todos
                </button>
                {GRUPOS.map(g => (
                  <button key={g} onClick={() => setGrupoActivo(g)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${grupoActivo === g ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Partidos */}
            <div className="space-y-2 mb-4">
              {matchesFiltrados.map(m => {
                const res = resultados[m.id]
                const miPick = picks[m.id]
                const cerrado = !!res
                let resultado: Pick | null = null
                if (res) {
                  if (res.goles_a > res.goles_b) resultado = 'A'
                  else if (res.goles_b > res.goles_a) resultado = 'B'
                  else resultado = 'empate'
                }
                const acerto = miPick && resultado && miPick === resultado
                return (
                  <div key={m.id} className={`bg-white rounded-xl border p-3.5 ${pendientes.has(m.id) ? 'border-amber-300' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400 font-medium">Grupo {m.grupo}</span>
                      {cerrado && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${acerto ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {res.goles_a}–{res.goles_b} {acerto ? '✅' : '❌'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex-1 text-sm font-medium text-gray-900">{m.equipoA}</span>
                      <span className="text-xs text-gray-400">vs</span>
                      <span className="flex-1 text-sm font-medium text-gray-900 text-right">{m.equipoB}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['A', 'empate', 'B'] as Pick[]).map(op => {
                        const label = op === 'A' ? m.equipoA.split(' ')[0] : op === 'B' ? m.equipoB.split(' ')[0] : 'Empate'
                        const sel = miPick === op
                        const esResultado = resultado === op
                        return (
                          <button key={op} disabled={cerrado}
                            onClick={() => setPick(m.id, op)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                              cerrado && esResultado ? 'bg-green-100 border-green-400 text-green-800' :
                              sel ? 'bg-blue-600 border-blue-600 text-white' :
                              'border-gray-200 text-gray-600 hover:bg-gray-50'
                            } ${cerrado ? 'cursor-default' : ''}`}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Botón guardar */}
            <button onClick={guardarPicks} disabled={guardando || pendientes.size === 0}
              className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
              style={{ background: pendientes.size > 0 ? '#1D9E75' : '#e5e7eb', color: pendientes.size > 0 ? '#fff' : '#9ca3af' }}>
              {guardando ? 'Guardando...' : pendientes.size > 0 ? `Guardar ${pendientes.size} picks pendientes` : '✅ Todo guardado'}
            </button>
          </>
        )}

        {/* TAB: TABLA */}
        {tab === 'tabla' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Clasificación general</h2>
            </div>
            {posiciones.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Los resultados aparecen aquí cuando el admin los cargue</p>
            ) : (
              posiciones.sort((a, b) => b.puntos_total - a.puntos_total).map((p, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${p.nombre === session?.user?.name ? 'bg-blue-50' : ''}`}>
                  <span className="text-sm font-medium text-gray-400 w-5">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{p.nombre} {p.nombre === session?.user?.name && <span className="text-xs text-blue-500">(tú)</span>}</p>
                    <p className="text-xs text-gray-400">{p.picks_correctos} aciertos de {p.picks_totales}</p>
                  </div>
                  <span className="text-base font-semibold text-blue-700">{p.puntos_total} pts</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: ADMIN */}
        {tab === 'admin' && esAdmin && <AdminPanel showToast={showToast} />}
      </main>
    </div>
  )
}

function AdminPanel({ showToast }: { showToast: (m: string) => void }) {
  const [invEmail, setInvEmail] = useState('')
  const [invNombre, setInvNombre] = useState('')
  const [partidoId, setPartidoId] = useState('')
  const [golesA, setGolesA] = useState('')
  const [golesB, setGolesB] = useState('')
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState(false)

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: invEmail, nombre: invNombre }) })
    const data = await res.json()
    if (data.ok) { showToast('✅ Invitación enviada'); setInvEmail(''); setInvNombre('') }
    else showToast('❌ ' + data.error)
  }

  async function cargarResultado(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partido_id: parseInt(partidoId), goles_a: parseInt(golesA), goles_b: parseInt(golesB) }) })
    const data = await res.json()
    if (data.ok) { showToast('✅ Resultado cargado y puntos calculados'); setPartidoId(''); setGolesA(''); setGolesB('') }
    else showToast('❌ ' + data.error)
  }

  async function enviarRecordatorio(jornada: number | null) {
    setEnviandoRecordatorio(true)
    const res = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jornada }) })
    const data = await res.json()
    setEnviandoRecordatorio(false)
    showToast(`✅ Recordatorio enviado a ${data.enviados} participantes`)
  }

  return (
    <div className="space-y-4">
      {/* Invitar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Invitar participante</h3>
        <form onSubmit={invitar} className="space-y-2">
          <input required value={invNombre} onChange={e => setInvNombre(e.target.value)} placeholder="Nombre" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input required type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="Email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Enviar invitación</button>
        </form>
      </div>

      {/* Cargar resultado */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Cargar resultado de partido</h3>
        <form onSubmit={cargarResultado} className="space-y-2">
          <input required value={partidoId} onChange={e => setPartidoId(e.target.value)} placeholder="ID del partido (1-72)" type="number" min={1} max={72} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-2">
            <input required value={golesA} onChange={e => setGolesA(e.target.value)} placeholder="Goles equipo A" type="number" min={0} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input required value={golesB} onChange={e => setGolesB(e.target.value)} placeholder="Goles equipo B" type="number" min={0} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Guardar resultado y calcular puntos</button>
        </form>
      </div>

      {/* Recordatorios */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Enviar recordatorio por email</h3>
        <p className="text-xs text-gray-500 mb-3">Se envía solo a quien tenga picks pendientes</p>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3].map(j => (
            <button key={j} disabled={enviandoRecordatorio} onClick={() => enviarRecordatorio(j)}
              className="py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Recordatorio Jornada {j}
            </button>
          ))}
          <button disabled={enviandoRecordatorio} onClick={() => enviarRecordatorio(null)}
            className="py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 col-span-2 disabled:opacity-50">
            {enviandoRecordatorio ? 'Enviando...' : '📧 Recordatorio general (todos los pendientes)'}
          </button>
        </div>
      </div>
    </div>
  )
}
