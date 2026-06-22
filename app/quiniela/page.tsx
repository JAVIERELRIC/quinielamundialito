'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { GRUPOS } from '@/lib/matches'

type Pick = 'A' | 'empate' | 'B'
type PicksMap = Record<number, Pick>
type ResultadosMap = Record<number, { goles_a: number; goles_b: number }>
type PosicionRow = { user_id: string; nombre: string; puntos_total: number; picks_correctos: number; picks_totales: number; jornada: number }
type Match = { id: number; grupo: string; equipo_a: string; equipo_b: string; jornada: number; fase: string; cerrado: boolean }
type UserProfile = { id: string; nombre: string; email: string; es_admin: boolean }

export default function QuinielaPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tab, setTab] = useState<'picks' | 'tabla' | 'reglas' | 'admin'>('picks')
  const [jornadaActiva, setJornadaActiva] = useState(1)
  const [grupoActivo, setGrupoActivo] = useState('todos')
  const [partidos, setPartidos] = useState<Match[]>([])
  const [jornadas, setJornadas] = useState<number[]>([1,2,3])
  const [picks, setPicks] = useState<PicksMap>({})
  const [savedPicks, setSavedPicks] = useState<Set<number>>(new Set())
  const [pendientes, setPendientes] = useState<Set<number>>(new Set())
  const [resultados, setResultados] = useState<ResultadosMap>({})
  const [posiciones, setPosiciones] = useState<PosicionRow[]>([])
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [pickCampeon, setPickCampeon] = useState<string | null>(null)
  const [campeonGuardado, setCampeonGuardado] = useState(false)
  const [predicciones, setPredicciones] = useState<Record<number, {a: number, b: number}>>({})
  const [equipos, setEquipos] = useState<string[]>([])

  // Nuevo estado para controlar qué jornada se visualiza exclusivamente en la pestaña de Tabla/Ranking
  const [jornadaTablaFiltro, setJornadaTablaFiltro] = useState(2)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase
        .from('profiles').select('*').eq('email', session.user.email).single()
      if (!prof) { router.push('/login'); return }
      setProfile(prof)
      
      // Cargar todos los partidos desde Supabase
      const { data: todosPartidos } = await supabase.from('partidos').select('id, grupo, equipo_a, equipo_b, jornada, fase, cerrado').order('id')
      if (todosPartidos) {
        setPartidos(todosPartidos)
        const jornadasUnicas: number[] = Array.from(new Set(todosPartidos.map((p: any) => p.jornada as number))).sort((a,b) => a-b)
        setJornadas(jornadasUnicas)
      }
      
      // Cargar picks
      const { data: picksData } = await supabase
        .from('picks').select('partido_id, pick').eq('user_id', prof.id)
      const map: PicksMap = {}
      picksData?.forEach((p: any) => { map[p.partido_id] = p.pick })
      setSavedPicks(new Set(picksData?.map((p: any) => p.partido_id) || []))
      setPicks(map)
      
      // Cargar resultados
      const { data: partidosResultados } = await supabase
        .from('partidos').select('id, goles_a, goles_b').not('goles_a', 'is', null)
      const resMap: ResultadosMap = {}
      partidosResultados?.forEach((p: any) => { resMap[p.id] = { goles_a: p.goles_a, goles_b: p.goles_b } })
      setResultados(resMap)
      
      // Cargar pick del campeon
      const { data: campeonData } = await supabase.from('picks_campeon').select('equipo').eq('user_id', prof.id).single()
      if (campeonData) { setPickCampeon(campeonData.equipo); setCampeonGuardado(true) }
      
      // Lista de equipos de grupos para el pick del campeon
      const { data: equiposData } = await supabase.from('partidos').select('equipo_a, equipo_b').eq('fase', 'grupos')
      if (equiposData) {
        const todos = equiposData.flatMap((p: any) => [p.equipo_a, p.equipo_b])
        setEquipos(Array.from(new Set(todos)).sort())
      }
      
      setLoading(false)
    })
  }, [])

  // Efecto secundario que recarga las posiciones cada vez que el usuario cambia la jornada en la UI
  useEffect(() => {
    if (!loading) {
      actualizarTablaPosiciones(jornadaTablaFiltro)
    }
  }, [jornadaTablaFiltro, loading])

  async function actualizarTablaPosiciones(numJornada: number) {
    const { data: pos } = await supabase
      .from('posiciones')
      .select('user_id, jornada, puntos_total, picks_correctos, picks_totales')
      .eq('jornada', numJornada) // 🔥 Filtro clave para erradicar los duplicados

    const { data: profs } = await supabase.from('profiles').select('id, nombre')
    const posConNombre = pos?.map((p: any) => ({
      ...p, nombre: profs?.find((pr: any) => pr.id === p.user_id)?.nombre || '?'
    })) || []
    
    setPosiciones(posConNombre)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function guardarCampeon(equipo: string) {
    if (!profile || campeonGuardado) return
    const { error } = await supabase.from('picks_campeon').upsert({ user_id: profile.id, equipo }, { onConflict: 'user_id' })
    if (!error) { setPickCampeon(equipo); setCampeonGuardado(true); showToast('🏆 Campeón guardado: ' + equipo) }
    else showToast('❌ Error al guardar')
  }

  function setPick(partidoId: number, pick: Pick) {
    setPicks(prev => ({ ...prev, [partidoId]: pick }))
    setPendientes(prev => { const s = new Set(prev); s.add(partidoId); return s })
  }

  async function guardarPicks() {
    if (!profile || pendientes.size === 0) return
    setGuardando(true)
    const rows = Array.from(pendientes)
      .filter(id => picks[id])
      .map(id => ({ 
        user_id: profile.id, 
        partido_id: id, 
        pick: picks[id], 
        goles_a_pred: predicciones[id]?.a ?? null,
        goles_b_pred: predicciones[id]?.b ?? null,
        updated_at: new Date().toISOString() 
      }))
    const { error } = await supabase.from('picks').upsert(rows, { onConflict: 'user_id,partido_id' })
    setGuardando(false)
    if (!error) { 
      setSavedPicks(prev => { const s = new Set(prev); rows.forEach((r: any) => s.add(r.partido_id)); return s }); 
      setPendientes(new Set()); 
      showToast(`✅ ${rows.length} picks guardados`) 
    }
    else showToast('❌ Error al guardar')
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const matchesFiltrados = partidos.filter(m =>
    m.jornada === jornadaActiva && (grupoActivo === 'todos' || m.grupo === grupoActivo)
  )
  const totalPicks = partidos.length
  const llenados = Object.keys(picks).length
  const pct = Math.round((llenados / totalPicks) * 100)

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <span className="font-semibold text-gray-900 text-sm">Quiniela Mundial 2026</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{profile?.nombre}</span>
            <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600">Salir</button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {((['picks', 'tabla', 'reglas', ...(profile?.es_admin ? ['admin'] : [])]) as const).map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'picks' ? '✏️ Mis picks' : t === 'tabla' ? '🏆 Tabla' : t === 'reglas' ? '📋 Reglas' : '⚙️ Admin'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">{toast}</div>}

        {tab === 'picks' && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-600">Tu avance total</span>
                <span className="font-medium text-green-700">{llenados}/{totalPicks} ({pct}%)</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {pendientes.size > 0 && <p className="text-xs text-amber-600 mt-1.5">⚠️ Tienes {pendientes.size} picks sin guardar</p>}
            </div>

            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 shrink-0">
                {jornadas.map(j => (
                  <button key={j} onClick={() => setJornadaActiva(j)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${jornadaActiva === j ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {['J1','J2','J3','16avos','Octavos','Cuartos','Semis','Final'][j-1] || 'J'+j}
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

            {jornadaActiva === 4 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🏆</span>
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Pick del Campeón — 10 puntos</p>
                    <p className="text-xs text-amber-700">{campeonGuardado ? "Ya elegiste tu campeón — no se puede cambiar" : "Elige ahora, no podrás cambiarlo después"}</p>
                  </div>
                </div>
                {campeonGuardado ? (
                  <div className="bg-amber-100 rounded-lg px-4 py-2 text-center">
                    <span className="font-semibold text-amber-900">🏆 Tu campeón: {pickCampeon}</span>
                  </div>
                ) : (
                  <select onChange={e => e.target.value && guardarCampeon(e.target.value)} defaultValue=""
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="">-- Elige tu campeón --</option>
                    {equipos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                )}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {matchesFiltrados.map(m => {
                const res = resultados[m.id]
                const miPick = picks[m.id]
                let resultado: Pick | null = null
                if (res) resultado = res.goles_a > res.goles_b ? 'A' : res.goles_b > res.goles_a ? 'B' : 'empate'
                const acerto = miPick && resultado && miPick === resultado
                return (
                  <div key={m.id} className={`bg-white rounded-xl border p-3.5 ${pendientes.has(m.id) ? 'border-amber-300' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400 font-medium">Grupo {m.grupo}</span>
                      {res && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${acerto ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{res.goles_a}–{res.goles_b} {acerto ? '✅' : '❌'}</span>}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex-1 text-sm font-medium text-gray-900">{m.equipo_a}</span>
                      <span className="text-xs text-gray-400">vs</span>
                      <span className="flex-1 text-sm font-medium text-gray-900 text-right">{m.equipo_b}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(m.fase === 'grupos' ? (['A', 'empate', 'B'] as Pick[]) : (['A', 'B'] as Pick[])).map(op => {
                        const label = op === 'A' ? m.equipo_a.split(' ')[0] : op === 'B' ? m.equipo_b.split(' ')[0] : 'Empate'
                        const sel = miPick === op
                        const esRes = resultado === op
                        return (
                          <button key={op} disabled={!!res || savedPicks.has(m.id)} onClick={() => setPick(m.id, op)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${res && esRes ? 'bg-green-100 border-green-400 text-green-800' : sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} ${(res || savedPicks.has(m.id)) ? 'cursor-default opacity-80' : ''}`}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={guardarPicks} disabled={guardando || pendientes.size === 0}
              className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
              style={{ background: pendientes.size > 0 ? '#1D9E75' : '#e5e7eb', color: pendientes.size > 0 ? '#fff' : '#9ca3af' }}>
              {guardando ? 'Guardando...' : pendientes.size > 0 ? `Guardar ${pendientes.size} picks` : '✅ Todo guardado'}
            </button>
          </>
        )}

        {tab === 'tabla' && (
          <TablaDetalle 
            posiciones={posiciones} 
            profile={profile} 
            supabase={supabase} 
            partidos={partidos} 
            jornadas={jornadas} 
            jornadaTablaFiltro={jornadaTablaFiltro}
            setJornadaTablaFiltro={setJornadaTablaFiltro}
          />
        )}

        {tab === 'reglas' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">📋 Reglas de la Quiniela</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-green-700 text-sm mb-2">✏️ Cómo llenar picks</h3>
                  <ul className="text-sm text-gray-600 space-y-1.5">
                    <li>• En fase de grupos elige: <strong>Local</strong>, <strong>Empate</strong> o <strong>Visitante</strong></li>
                    <li>• En eliminatorias (16avos en adelante) solo <strong>Local</strong> o <strong>Visitante</strong> — no hay empate</li>
                    <li>• Una vez que presionas <strong>"Guardar picks"</strong>, no puedes cambiarlos</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'admin' && profile?.es_admin && <AdminPanel showToast={showToast} adminEmail={profile.email} />}
      </main>
    </div>
  )
}

type DetalleRow = { partido_id: number; equipo_a: string; equipo_b: string; pick: string; goles_a: number | null; goles_b: number | null; puntos: number; fase: string }
type PicksGlobales = Record<string, Record<number, string>>

function TablaDetalle({ 
  posiciones, 
  profile, 
  supabase, 
  partidos, 
  jornadas,
  jornadaTablaFiltro,
  setJornadaTablaFiltro 
}: { 
  posiciones: any[]; 
  profile: any; 
  supabase: any; 
  partidos: any[]; 
  jornadas: number[];
  jornadaTablaFiltro: number;
  setJornadaTablaFiltro: (j: number) => void;
}) {
  const [vistaMode, setVistaMode] = useState<'ranking' | 'picks'>('ranking')
  const [grupoFiltro, setGrupoFiltro] = useState('todos')
  const [picksGlobales, setPicksGlobales] = useState<PicksGlobales>({})
  const [loadingPicks, setLoadingPicks] = useState(false)
  const [perfiles, setPerfiles] = useState<any[]>([])

  const JORNADA_LABELS2: Record<number, string> = {1:'J1',2:'J2',3:'J3',4:'16avos',5:'Octavos',6:'Cuartos',7:'Semis',8:'Final'}
  const grupos = ['todos', ...Array.from(new Set(partidos.filter(p => p.jornada === jornadaTablaFiltro && p.grupo.length <= 2).map(p => p.grupo))).sort()]

  async function cargarPicksGlobales() {
    if (Object.keys(picksGlobales).length > 0) return
    setLoadingPicks(true)
    const { data: allPicks } = await supabase.from('picks').select('user_id, partido_id, pick')
    const { data: profs } = await supabase.from('profiles').select('id, nombre')
    const map: PicksGlobales = {}
    allPicks?.forEach((p: any) => {
      if (!map[p.user_id]) map[p.user_id] = {}
      map[p.user_id][p.partido_id] = p.pick
    })
    setPicksGlobales(map)
    setPerfiles(profs || [])
    setLoadingPicks(false)
  }

  function switchToPicks() {
    setVistaMode('picks')
    cargarPicksGlobales()
  }

  const partidosFiltrados = partidos.filter(p =>
    p.jornada === jornadaTablaFiltro && (grupoFiltro === 'todos' || p.grupo === grupoFiltro)
  )

  const pickLabel = (pick: string, pa: string, pb: string) => {
    if (pick === 'A') return pa.split(' ')[0]
    if (pick === 'B') return pb.split(' ')[0]
    if (pick === 'empate') return 'Emp'
    return '—'
  }
  const [vistaDetalle, setVistaDetalle] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<DetalleRow[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  async function verDetalle(userId: string, nombre: string) {
    if (vistaDetalle === nombre) { setVistaDetalle(null); return }
    setLoadingDetalle(true)
    setVistaDetalle(nombre)
    const { data: picksData } = await supabase
      .from('picks')
      .select('partido_id, pick, puntos')
      .eq('user_id', userId)
    const { data: partidosData } = await supabase
      .from('partidos')
      .select('id, equipo_a, equipo_b, goles_a, goles_b, fase')
      .order('id')
    const rows: DetalleRow[] = (picksData || []).map((p: any) => {
      const partido = partidosData?.find((pt: any) => pt.id === p.partido_id)
      return {
        partido_id: p.partido_id,
        equipo_a: partido?.equipo_a || '?',
        equipo_b: partido?.equipo_b || '?',
        pick: p.pick,
        goles_a: partido?.goles_a ?? null,
        goles_b: partido?.goles_b ?? null,
        puntos: p.puntos,
        fase: partido?.fase || 'grupos',
      }
    }).sort((a: DetalleRow, b: DetalleRow) => a.partido_id - b.partido_id)
    setDetalle(rows)
    setLoadingDetalle(false)
  }

  const faseLabel: Record<string, string> = {
    grupos: 'Grupos', '16avos': '16avos', octavos: 'Octavos',
    cuartos: 'Cuartos', semis: 'Semis', tercer_lugar: '3er lugar', final: 'Final'
  }

  return (
    <div className="space-y-3">
      {/* Selector de Jornadas Superior para el Tablero General */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Filtrar clasificación por jornada:</p>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {jornadas.map(j => (
            <button key={j} onClick={() => setJornadaTablaFiltro(j)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${jornadaTablaFiltro === j ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {['J1','J2','J3','16avos','Octavos','Cuartos','Semis','Final'][j-1] || 'J'+j}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
        <button onClick={() => setVistaMode('ranking')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${vistaMode === 'ranking' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          🏆 Ranking
        </button>
        <button onClick={switchToPicks}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${vistaMode === 'picks' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          👀 Ver picks de todos
        </button>
      </div>

      {vistaMode === 'picks' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
                <span className="px-2.5 py-1 text-xs font-bold text-gray-800 bg-white rounded shadow">
                  {JORNADA_LABELS2[jornadaTablaFiltro] || 'J' + jornadaTablaFiltro}
                </span>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                {grupos.map(g => (
                  <button key={g} onClick={() => setGrupoFiltro(g)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${grupoFiltro === g ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                    {g === 'todos' ? 'Todos' : g}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {loadingPicks ? (
            <p className="text-center text-gray-400 text-sm py-8">Cargando picks...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-max">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 sticky left-0 bg-gray-50">Partido</th>
                    {perfiles.map(p => (
                      <th key={p.id} className={`px-3 py-2 font-medium text-center whitespace-nowrap ${p.id === profile?.id ? 'text-blue-600' : 'text-gray-500'}`}>
                        {p.nombre.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partidosFiltrados.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 sticky left-0 bg-white">
                        <span className="font-medium text-gray-800">{m.equipo_a.split(' ')[0]} vs {m.equipo_b.split(' ')[0]}</span>
                        {m.goles_a !== null && <span className="ml-1 text-gray-400">({m.goles_a}-{m.goles_b})</span>}
                      </td>
                      {perfiles.map(p => {
                        const pick = picksGlobales[p.id]?.[m.id]
                        const tieneResultado = m.goles_a !== null
                        let resultado: string | null = null
                        if (tieneResultado) resultado = m.goles_a > m.goles_b ? 'A' : m.goles_b > m.goles_a ? 'B' : 'empate'
                        const acerto = pick && resultado && pick === resultado
                        return (
                          <td key={p.id} className={`px-3 py-2 text-center font-medium ${tieneResultado && pick ? (acerto ? 'text-green-700 bg-green-50' : 'text-red-500 bg-red-50') : 'text-gray-600'}`}>
                            {pick ? pickLabel(pick, m.equipo_a, m.equipo_b) : <span className="text-gray-300">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {vistaMode === 'ranking' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Clasificación — {JORNADA_LABELS2[jornadaTablaFiltro] || 'J'+jornadaTablaFiltro}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Toca un nombre para ver el detalle</p>
            </div>
            <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-800 rounded-md">Puntos por Jornada</span>
          </div>
          {posiciones.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No hay registros calculados para esta jornada aún.</p>
          ) : (
            [...posiciones].sort((a, b) => b.puntos_total - a.puntos_total).map((p, i) => (
              <div key={i}>
                <button onClick={() => verDetalle(p.user_id, p.nombre)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${p.nombre === profile?.nombre ? 'bg-blue-50' : ''}`}>
                  <span className="text-sm font-medium text-gray-400 w-5">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{p.nombre} {p.nombre === profile?.nombre && <span className="text-xs text-blue-500">(tú)</span>}</p>
                    <p className="text-xs text-gray-400">{p.picks_correctos} aciertos en esta jornada</p>
                  </div>
                  <span className="text-base font-semibold text-blue-700">{p.puntos_total} pts</span>
                  <span className="text-gray-400 text-xs">{vistaDetalle === p.nombre ? '▲' : '▼'}</span>
                </button>
                {vistaDetalle === p.nombre && (
                  <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
                    {loadingDetalle ? (
                      <p className="text-xs text-gray-400 text-center py-2">Cargando...</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-200">
                              <th className="text-left pb-2 font-medium">Partido</th>
                              <th className="text-center pb-2 font-medium">Resultado</th>
                              <th className="text-center pb-2 font-medium">Pick</th>
                              <th className="text-center pb-2 font-medium">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalle
                              .filter((d) => partidos.find((m) => m.id === d.partido_id)?.jornada === jornadaTablaFiltro)
                              .map((d, idx) => {
                                const tieneResultado = d.goles_a !== null && d.goles_b !== null
                                const labelPick = d.pick === 'A' ? d.equipo_a.split(' ')[0] : d.pick === 'B' ? d.equipo_b.split(' ')[0] : 'Empate'
                                return (
                                  <tr key={idx} className={`border-b border-gray-100 last:border-0 ${d.puntos > 0 ? 'bg-green-50' : tieneResultado ? 'bg-red-50' : ''}`}>
                                    <td className="py-1.5 pr-2">
                                      <span className="text-gray-500">{faseLabel[d.fase] || d.fase} #{d.partido_id}</span><br/>
                                      <span className="font-medium text-gray-800">{d.equipo_a} vs {d.equipo_b}</span>
                                    </td>
                                    <td className="py-1.5 text-center text-gray-600">
                                      {tieneResultado ? `${d.goles_a}-${d.goles_b}` : '—'}
                                    </td>
                                    <td className="py-1.5 text-center font-medium text-gray-800">{labelPick}</td>
                                    <td className="py-1.5 text-center font-semibold">
                                      {tieneResultado ? (
                                        <span className={d.puntos > 0 ? 'text-green-700' : 'text-red-500'}>
                                          {d.puntos > 0 ? `+${d.puntos}` : '0'}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function AdminPanel({ showToast, adminEmail }: { showToast: (m: string) => void; adminEmail: string }) {
  const [invEmail, setInvEmail] = useState('')
  const [invNombre, setInvNombre] = useState('')
  const [partidoId, setPartidoId] = useState('')
  const [golesA, setGolesA] = useState('')
  const [golesB, setGolesB] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: invEmail, nombre: invNombre }) })
    const data = await res.json()
    if (data.ok) { showToast('✅ Invitación enviada'); setInvEmail(''); setInvNombre('') }
    else showToast('❌ ' + data.error)
  }

  async function cargarResultado(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partido_id: parseInt(partidoId), goles_a: parseInt(golesA), goles_b: parseInt(golesB), admin_email: adminEmail }) })
    const data = await res.json()
    if (data.ok) { showToast('✅ Resultado cargado'); setPartidoId(''); setGolesA(''); setGolesB('') }
    else showToast('❌ ' + data.error)
  }

  async function enviarRecordatorio(jornada: number | null) {
    setEnviando(true)
    const res = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jornada, admin_email: adminEmail }) })
    const data = await res.json()
    setEnviando(false)
    showToast(`✅ Recordatorio enviado a ${data.enviados} personas`)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Invitar participante</h3>
        <form onSubmit={invitar} className="space-y-2">
          <input required value={invNombre} onChange={e => setInvNombre(e.target.value)} placeholder="Nombre" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input required type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="Email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Enviar invitación</button>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Cargar resultado</h3>
        <form onSubmit={cargarResultado} className="space-y-2">
          <input required value={partidoId} onChange={e => setPartidoId(e.target.value)} placeholder="ID del partido (1-104)" type="number" min={1} max={104} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-2">
            <input required value={golesA} onChange={e => setGolesA(e.target.value)} placeholder="Goles equipo A" type="number" min={0} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input required value={golesB} onChange={e => setGolesB(e.target.value)} placeholder="Goles equipo B" type="number" min={0} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Guardar y calcular puntos</button>
        </form>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Enviar recordatorio</h3>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3].map(j => (
            <button key={j} disabled={enviando} onClick={() => enviarRecordatorio(j)} className="py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Jornada {j}
            </button>
          ))}
          <button disabled={enviando} onClick={() => enviarRecordatorio(null)} className="py-2 bg-amber-500 text-white rounded-lg text-sm font-medium col-span-2 disabled:opacity-50">
            {enviando ? 'Enviando...' : '📧 Recordatorio general'}
          </button>
        </div>
      </div>
    </div>
  )
}