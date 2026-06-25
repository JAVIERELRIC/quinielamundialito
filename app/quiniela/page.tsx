'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { GRUPOS } from '@/lib/matches'

type PickOption = 'A' | 'empate' | 'B'
type PicksMap = Record<number, PickOption>
type ResultadosMap = Record<number, { goles_a: number; goles_b: number }>
type PosicionRow = { user_id: string; nombre: string; puntos_total: number; picks_correctos: number; picks_totales: number; jornada: number }

type DetalleRow = {
    partido_id: number;
    equipo_a: string;
    equipo_b: string;
    pick: string;
    goles_a: number | null;
    goles_b: number | null;
    puntos: number;
    fase: string
}

type PickFromView = {
    pick_id: number
    user_id: string
    partido_id: number
    mi_ganador_pred: PickOption
    goles_a_pred: number | null
    goles_b_pred: number | null
    predice_penales: boolean
    goles_a_reales: number | null
    goles_b_reales: number | null
    puntos_fase: number
    jornada: number
    fase: string
    resultado_real: string
    acerto_ganador: number
    acerto_marcador_exacto: number
    acerto_tanda_penales: number
}

type Match = { id: number; grupo: string; equipo_a: string; equipo_b: string; jornada: number; fase: string; cerrado: boolean; fecha_hora?: string }
type UserProfile = { id: string; nombre: string; email: string; es_admin: boolean }
type PicksGlobales = Record<string, Record<number, string>>

export default function QuinielaPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [tab, setTab] = useState<'picks' | 'tabla' | 'reglas' | 'admin'>('picks')
    const [jornadaActiva, setJornadaActiva] = useState(1)
    const [grupoActivo, setGrupoActivo] = useState('todos')
    const [partidos, setPartidos] = useState<Match[]>([])
    const [jornadas, setJornadas] = useState<number[]>([1, 2, 3])
    const [picksViewData, setPicksViewData] = useState<PickFromView[]>([])
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
    const [predicciones, setPredicciones] = useState<Record<number, { a: number, b: number }>>({})
    const [penalesPred, setPenalesPred] = useState<Record<number, boolean>>({})
    const [equipos, setEquipos] = useState<string[]>([])
    const [partidosDeHoy, setPartidosDeHoy] = useState<Match[]>([])
    const [jornadaTablaFiltro, setJornadaTablaFiltro] = useState(2)

    const cargarDatosQuiniela = async (userId: string) => {
        const { data: picksData } = await supabase
            .from('vista_picks_puntos')
            .select('*')
            .eq('user_id', userId)

        if (picksData) {
            setPicksViewData(picksData as PickFromView[])
            const map: PicksMap = {}
            const predMap: Record<number, { a: number, b: number }> = {}
            const penalesMap: Record<number, boolean> = {}

            picksData.forEach((p: any) => {
                map[p.partido_id] = p.mi_ganador_pred
                if (p.goles_a_pred !== null && p.goles_b_pred !== null) {
                    predMap[p.partido_id] = { a: p.goles_a_pred, b: p.goles_b_pred }
                }
                penalesMap[p.partido_id] = p.predice_penales ?? false
            })
            setSavedPicks(new Set(picksData.map((p: any) => p.partido_id)))
            setPicks(map)
            setPredicciones(predMap)
            setPenalesPred(penalesMap)
        }
    }

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) { router.push('/login'); return }

            const { data: profs } = await supabase.from('profiles').select('*').eq('email', session.user.email)
            if (!profs || profs.length === 0) {
                await supabase.auth.signOut()
                router.push('/login')
                return
            }
            setProfile(profs[0])

            const { data: todosPartidos } = await supabase.from('partidos').select('id, grupo, equipo_a, equipo_b, jornada, fase, cerrado, fecha_hora').order('id')
            if (todosPartidos) {
                setPartidos(todosPartidos)
                const jornadasUnicas: number[] = Array.from(new Set(todosPartidos.map((p: any) => p.jornada as number))).sort((a, b) => a - b)
                setJornadas(jornadasUnicas)
            }

            await cargarDatosQuiniela(profs[0].id)

            const { data: partidosResultados } = await supabase.from('partidos').select('id, goles_a, goles_b').not('goles_a', 'is', null)
            const resMap: ResultadosMap = {}
            partidosResultados?.forEach((p: any) => { resMap[p.id] = { goles_a: p.goles_a, goles_b: p.goles_b } })
            setResultados(resMap)

            const { data: campeonData } = await supabase.from('picks_campeon').select('equipo').eq('user_id', profs[0].id).single()
            if (campeonData) { setPickCampeon(campeonData.equipo); setCampeonGuardado(true) }

            const { data: equiposData } = await supabase.from('partidos').select('equipo_a, equipo_b').eq('fase', 'grupos')
            if (equiposData) {
                const todos = equiposData.flatMap((p: any) => [p.equipo_a, p.equipo_b])
                setEquipos(Array.from(new Set(todos)).sort())
            }

            fetch('/api/partidos-hoy', { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    if (data.ok) setPartidosDeHoy(data.partidos)
                })
                .catch(err => console.error('Error cargando partidos de hoy:', err))

            setLoading(false)
        })
    }, [])

    useEffect(() => {
        if (!loading) {
            actualizarTablaPosiciones(jornadaTablaFiltro)
        }
    }, [jornadaTablaFiltro, loading])

    async function actualizarTablaPosiciones(numJornada: number) {
        const { data: pos } = await supabase.from('posiciones').select('user_id, jornada, puntos_total, picks_correctos, picks_totales').eq('jornada', numJornada)
        const { data: profs } = await supabase.from('profiles').select('id, nombre')

        // Traemos de respaldo todos los picks calculados en caliente para inyectar el puntaje real al ranking
        const { data: todosPicks } = await supabase.from('vista_picks_puntos').select('user_id, partido_id, mi_ganador_pred, goles_a_pred, goles_b_pred, goles_a_reales, goles_b_reales, puntos_fase, acerto_tanda_penales, jornada')

        const { data: todosProfs } = await supabase.from('profiles').select('id, nombre')

        // Mapeamos asegurando que si un usuario no tiene fila en "posiciones" (como Kaleb), aparezca de todas formas
        const baseUsuarios = todosProfs?.map((u: any) => {
            const filaPos = pos?.find((p: any) => p.user_id === u.id)

            // Calculamos la suma en caliente por usuario de esta jornada específica
            const picksUsuarioJornada = todosPicks?.filter((p: any) => p.user_id === u.id && p.jornada === numJornada) || []

            let puntosCalientes = 0
            let aciertosCalientes = 0

            picksUsuarioJornada.forEach((p: any) => {
                const partidoYaSeJugo = p.goles_a_reales !== null && p.goles_b_reales !== null
                if (partidoYaSeJugo) {
                    let resultadoReal = 'empate'
                    if (p.goles_a_reales > p.goles_b_reales) resultadoReal = 'A'
                    if (p.goles_a_reales < p.goles_b_reales) resultadoReal = 'B'

                    if (p.mi_ganador_pred === resultadoReal) {
                        puntosCalientes += p.puntos_fase || 1
                        aciertosCalientes += 1
                    }
                    if (p.goles_a_pred === p.goles_a_reales && p.goles_b_pred === p.goles_b_reales) {
                        puntosCalientes += 1
                    }
                    if (p.acerto_tanda_penales === 1) {
                        puntosCalientes += 1
                    }
                }
            })

            return {
                user_id: u.id,
                nombre: u.nombre || '?',
                puntos_total: puntosCalientes,
                picks_correctos: aciertosCalientes,
                picks_totales: filaPos?.picks_totales || 0,
                jornada: numJornada
            }
        }) || []

        setPosiciones(baseUsuarios)
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

    function setPick(partidoId: number, pick: PickOption) {
        setPicks(prev => ({ ...prev, [partidoId]: pick }))
        setPendientes(prev => { const s = new Set(prev); s.add(partidoId); return s })
    }

    function togglePenalesPred(partidoId: number) {
        setPenalesPred(prev => ({ ...prev, [partidoId]: !prev[partidoId] }))
        setPendientes(prev => { const s = new Set(prev); s.add(partidoId); return s })
    }

    function setGolesPred(partidoId: number, equipo: 'a' | 'b', valor: number) {
        setPredicciones(prev => ({ ...prev, [partidoId]: { ...prev[partidoId], [equipo]: valor } }))
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
                predice_penales: penalesPred[id] ?? false,
                updated_at: new Date().toISOString()
            }))
        const { error } = await supabase.from('picks').upsert(rows, { onConflict: 'user_id,partido_id' })
        setGuardando(false)
        if (!error) {
            setPendientes(new Set());
            showToast(`✅ ${rows.length} picks guardados`)
            await cargarDatosQuiniela(profile.id)
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
                            {pendientes.size > 0 && <p className="text-xs text-amber-600 mt-1.5">⚠️ Tienes {pendientes.size} picks sin guardar o modificados</p>}
                        </div>

                        {partidosDeHoy.length > 0 && (
                            <div className="bg-gradient-to-br from-gray-900 to-blue-950 text-white rounded-xl p-4 mb-4 shadow-lg border border-white/5">
                                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">Próximos Partidos</h3>
                                    </div>
                                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium">Agenda</span>
                                </div>

                                <div className="space-y-4">
                                    {partidosDeHoy.map(m => {
                                        const res = resultados[m.id]

                                        const fechaPartidoUTC = m.fecha_hora ? new Date(m.fecha_hora) : new Date()
                                        const hoyLocal = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Monterrey' })
                                        const partidoLocal = fechaPartidoUTC.toLocaleDateString('es-MX', { timeZone: 'America/Monterrey' })
                                        const esHoy = hoyLocal === partidoLocal

                                        const horaFormateada = fechaPartidoUTC.toLocaleTimeString('es-MX', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true,
                                            timeZone: 'America/Monterrey'
                                        })

                                        return (
                                            <div key={m.id} className="flex flex-col gap-1 bg-white/5 rounded-lg p-2.5 transition-all hover:bg-white/10">
                                                <div className="flex justify-between items-center text-[11px] text-gray-400 font-medium px-0.5">
                                                    <span>{esHoy ? '🔥 Hoy' : '📅 Mañana'} — {horaFormateada}</span>
                                                    <span className="text-[10px] opacity-75">{m.fase === 'grupos' ? `Grupo ${m.grupo}` : m.fase}</span>
                                                </div>

                                                <div className="flex items-center justify-between text-sm mt-1">
                                                    <div className="flex-1 text-left font-semibold text-gray-100 truncate">{m.equipo_a}</div>

                                                    <div className="px-3 py-0.5 bg-white/10 rounded-md text-center min-w-[65px] mx-2">
                                                        {res ? (
                                                            <span className="font-bold text-green-400 font-mono text-xs">{res.goles_a} - {res.goles_b}</span>
                                                        ) : m.cerrado ? (
                                                            <span className="text-[10px] text-amber-400 font-medium uppercase tracking-tight">Cerrado</span>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-300 font-medium">Por jugar</span>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 text-right font-semibold text-gray-100 truncate">{m.equipo_b}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 shrink-0">
                                {jornadas.map(j => (
                                    <button key={j} onClick={() => setJornadaActiva(j)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${jornadaActiva === j ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                        {['J1', 'J2', 'J3', '16avos', 'Octavos', 'Cuartos', 'Semis', 'Final'][j - 1] || 'J' + j}
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
                                const pickDataFromView = picksViewData.find(p => p.partido_id === m.id)
                                const acertoGanador = pickDataFromView?.acerto_ganador === 1
                                const acertoMarcadorExacto = pickDataFromView?.acerto_marcador_exacto === 1
                                const acertoPenales = pickDataFromView?.acerto_tanda_penales === 1

                                const statusBadgeColor = res
                                    ? acertoMarcadorExacto
                                        ? 'bg-green-100 text-green-700'
                                        : (acertoGanador || acertoPenales)
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-50 text-red-600'
                                    : 'bg-gray-100 text-gray-600'

                                return (
                                    <div key={m.id} className={`bg-white rounded-xl border p-3.5 ${pendientes.has(m.id) ? 'border-amber-300' : 'border-gray-200'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs text-gray-400 font-medium">Grupo {m.grupo}</span>
                                            {res && (
                                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusBadgeColor}`}>
                                                    {res.goles_a}–{res.goles_b} {acertoMarcadorExacto ? '🎯' : (acertoGanador || acertoPenales) ? '✅' : '❌'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="flex-1 text-sm font-medium text-gray-900">{m.equipo_a}</span>
                                            <span className="text-xs text-gray-400">vs</span>
                                            <span className="flex-1 text-sm font-medium text-gray-900 text-right">{m.equipo_b}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {(m.fase === 'grupos' ? (['A', 'empate', 'B'] as PickOption[]) : (['A', 'B'] as PickOption[])).map(op => {
                                                const label = op === 'A' ? m.equipo_a.split(' ')[0] : op === 'B' ? m.equipo_b.split(' ')[0] : 'Empate'
                                                const sel = miPick === op
                                                return (
                                                    <button key={op} disabled={!!res || m.cerrado} onClick={() => setPick(m.id, op)}
                                                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} ${(res || m.cerrado) ? 'cursor-default opacity-80' : ''}`}>
                                                        {label}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {m.jornada >= 4 && (
                                            <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                                                <p className="text-[11px] font-medium text-gray-500 mb-1.5 text-center">
                                                    🎯 Opcional: ¡Acierta el marcador exacto para obtener +1 punto extra!
                                                </p>
                                                <div className="flex items-center gap-2 justify-center">
                                                    <div className="text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={20}
                                                            placeholder="0"
                                                            disabled={m.cerrado || !!res}
                                                            value={predicciones[m.id]?.a ?? ''}
                                                            onChange={e => setGolesPred(m.id, 'a', parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 0)}
                                                            className="w-12 text-center border border-gray-300 rounded-md py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 disabled:bg-gray-100"
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-400">-</span>
                                                    <div className="text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={20}
                                                            placeholder="0"
                                                            disabled={m.cerrado || !!res}
                                                            value={predicciones[m.id]?.b ?? ''}
                                                            onChange={e => setGolesPred(m.id, 'b', parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 0)}
                                                            className="w-12 text-center border border-gray-300 rounded-md py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 disabled:bg-gray-100"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-2.5 border-t border-gray-200/60 pt-2 flex items-center justify-center">
                                                    <label className="text-xs font-medium text-gray-600 flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            disabled={m.cerrado || !!res}
                                                            checked={!!penalesPred[m.id]}
                                                            onChange={() => togglePenalesPred(m.id)}
                                                            className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-3.5 w-3.5"
                                                        />
                                                        ¿Se define en penales? <span>(+1 pt extra)</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
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
                                        <li>• En eliminatorias solo <strong>Local</strong> o <strong>Visitante</strong></li>
                                        <li>• Los cambios están permitidos antes de que inicie cada encuentro.</li>
                                        <li>• En fase eliminatoria, acertar el marcador exacto añade un <strong>+1 punto extra</strong>.</li>
                                        <li className="text-green-700 font-medium">• Si se define en penales y acertaste la casilla, sumas <strong>+1 punto extra</strong>.</li>
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

    const JORNADA_LABELS2: Record<number, string> = { 1: 'J1', 2: 'J2', 3: 'J3', 4: '16avos', 5: 'Octavos', 6: 'Cuartos', 7: 'Semis', 8: 'Final' }
    const partidosFiltrados = partidos.filter(p => p.jornada === jornadaTablaFiltro && (grupoFiltro === 'todos' || p.grupo === grupoFiltro))

    const renderEstiloCeldaPick = (pick: string, pa: string, pb: string) => {
        const valor = pick?.trim().toLowerCase()
        if (!valor) return <span className="text-gray-300 font-medium">—</span>

        if (valor === 'empate') {
            return (
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-tight">
                    🤝 Emp
                </span>
            )
        }
        if (valor === 'a') {
            return (
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-800 border border-green-200 uppercase tracking-tight">
                    🏠 {pa.substring(0, 3).toUpperCase()}
                </span>
            )
        }
        if (valor === 'b') {
            return (
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-tight">
                    🚀 {pb.substring(0, 3).toUpperCase()}
                </span>
            )
        }
        return <span className="text-gray-400">—</span>
    }

    const [vistaDetalle, setVistaDetalle] = useState<string | null>(null)
    const [detalle, setDetalle] = useState<DetalleRow[]>([])
    const [loadingDetalle, setLoadingDetalle] = useState(false)

    // 🎯 ORDENAR RANKING ESTRICTAMENTE DE MAYOR A MENOR PUNTAJE
    const posicionesOrdenadas = [...posiciones].sort((a, b) => b.puntos_total - a.puntos_total)

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
        picksGlobales && setPicksGlobales(map)
        setPerfiles(profs || [])
        setLoadingPicks(false)
    }

    async function verDetalle(userId: string, nombre: string, numJornada: number) {
        if (vistaDetalle === nombre) { setVistaDetalle(null); return }
        setLoadingDetalle(true)
        setVistaDetalle(nombre)

        const { data: picksData } = await supabase
            .from('vista_picks_puntos')
            .select('partido_id, mi_ganador_pred, goles_a_pred, goles_b_pred, goles_a_reales, goles_b_reales, puntos_fase, acerto_ganador, acerto_marcador_exacto, acerto_tanda_penales, jornada')
            .eq('user_id', userId)

        const mappedRows = (picksData || [])
            .filter((p: any) => p.jornada === numJornada)
            .map((p: any) => {
                const partido = partidos.find((pt: any) => pt.id === p.partido_id)
                let puntosGanados = 0

                const golesRealA = p.goles_a_reales
                const golesRealB = p.goles_b_reales
                const partidoYaSeJugo = golesRealA !== null && golesRealB !== null

                if (partidoYaSeJugo) {
                    let resultadoReal = 'empate'
                    if (golesRealA > golesRealB) resultadoReal = 'A'
                    if (golesRealA < golesRealB) resultadoReal = 'B'

                    const acertoGanador = p.mi_ganador_pred === resultadoReal
                    if (acertoGanador) {
                        puntosGanados += p.puntos_fase || 1
                    }

                    const acertoMarcadorExacto = p.goles_a_pred === golesRealA && p.goles_b_pred === golesRealB
                    if (acertoMarcadorExacto) {
                        puntosGanados += 1
                    }

                    if (p.acerto_tanda_penales === 1) {
                        puntosGanados += 1
                    }
                }

                return {
                    partido_id: p.partido_id,
                    equipo_a: partido?.equipo_a || '?',
                    equipo_b: partido?.equipo_b || '?',
                    pick: p.mi_ganador_pred,
                    goles_a: golesRealA,
                    goles_b: golesRealB,
                    puntos: puntosGanados,
                    fase: partido?.fase || 'grupos'
                }
            })

        const rows: DetalleRow[] = mappedRows.sort((a: any, b: any) => {
            return (a.partido_id || 0) - (b.partido_id || 0)
        })

        setDetalle(rows)
        setLoadingDetalle(false)
    }

    return (
        <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex gap-1 overflow-x-auto pb-1">
                    {jornadas.map(j => (
                        <button key={j} onClick={() => setJornadaTablaFiltro(j)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${jornadaTablaFiltro === j ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {JORNADA_LABELS2[j] || 'J' + j}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
                <button onClick={() => setVistaMode('ranking')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${vistaMode === 'ranking' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    🏆 Ranking
                </button>
                <button onClick={() => { setVistaMode('picks'); cargarPicksGlobales(); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${vistaMode === 'picks' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    👀 Ver picks
                </button>
            </div>

            {vistaMode === 'picks' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {loadingPicks ? <p className="p-4 text-xs text-center text-gray-500">Cargando picks globales...</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-max border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        <th className="text-left px-4 py-3 sticky left-0 bg-gray-50 font-semibold text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Partido</th>
                                        {perfiles.map(p => <th key={p.id} className="px-3 py-3 text-center text-gray-600 font-semibold">{p.nombre.split(' ')[0]}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {partidosFiltrados.map(m => (
                                        <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-2.5 sticky left-0 bg-white font-medium text-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <span className="truncate block max-w-[160px]">{m.equipo_a.split(' ')[0]} vs {m.equipo_b.split(' ')[0]}</span>
                                            </td>
                                            {perfiles.map(p => {
                                                const pick = picksGlobales[p.id]?.[m.id]
                                                return (
                                                    <td key={p.id} className="px-2 py-2.5 text-center vertical-middle">
                                                        {renderEstiloCeldaPick(pick, m.equipo_a, m.equipo_b)}
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
                    {posicionesOrdenadas.map((p, i) => (
                        <div key={i}>
                            <button onClick={() => verDetalle(p.user_id, p.nombre, jornadaTablaFiltro)}
                                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 font-medium transition-colors">
                                <span className="text-gray-400 w-5 text-xs">{i + 1}</span>
                                <div className="flex-1 text-left">
                                    <p className="text-sm text-gray-900">{p.nombre}</p>
                                    <p className="text-xs text-gray-400">{p.picks_correctos} aciertos</p>
                                </div>
                                <span className="text-blue-700 text-sm font-semibold">{p.puntos_total} pts</span>
                            </button>

                            {vistaDetalle === p.nombre && (
                                <div className="bg-gray-50/70 border-b border-gray-100 p-4 text-xs">
                                    {loadingDetalle ? (
                                        <p className="text-center text-gray-500 py-2">Cargando desglose...</p>
                                    ) : (
                                        <div className="max-w-md mx-auto bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-semibold">
                                                            <th className="py-2 px-3 text-left">Enfrentamiento</th>
                                                            <th className="py-2.5 px-3 text-center">Predicción</th> {/* 👈 Nueva columna */}
                                                        <th className="py-2 px-3 text-center">Resultado</th>
                                                        <th className="py-2 px-3 text-center">Puntos</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detalle.map((d, idx) => {
                                                        const tieneResultado = d.goles_a !== null && d.goles_b !== null
                                                        const filaEstilo = tieneResultado
                                                            ? d.puntos > 0 ? 'bg-green-50/40 text-green-900' : 'bg-red-50/40 text-red-900'
                                                            : '';

                                                        return (
                                                            <tr key={idx} className={`border-b border-gray-50 last:border-0 ${filaEstilo}`}>
                                                                {/* 🏠 🤝 🚀 COLUMNA NUEVA: Muestra de forma limpia la elección del usuario */}
                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                    {renderEstiloCeldaPick(d.pick, d.equipo_a, d.equipo_b)}
                                                                </td>
                                                                <td className="py-2 px-3 text-left font-medium">{d.equipo_a} vs {d.equipo_b}</td>
                                                                <td className="py-2 px-3 text-center font-mono font-semibold">{tieneResultado ? `${d.goles_a}-${d.goles_b}` : '—'}</td>
                                                                <td className="py-2 px-3 text-center font-bold">
                                                                    <span className={d.puntos > 0 ? 'text-green-700' : 'text-gray-400'}>+{d.puntos}</span>
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
                    ))}
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

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4">
                <h3 className="font-medium mb-3">Invitar participante</h3>
                <form onSubmit={invitar} className="space-y-2">
                    <input required value={invNombre} onChange={e => setInvNombre(e.target.value)} placeholder="Nombre" className="w-full border rounded-lg px-3 py-2 text-sm" />
                    <input required type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2 text-sm" />
                    <button type="submit" className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Enviar invitación</button>
                </form>
            </div>
            <div className="bg-white rounded-xl border p-4">
                <h3 className="font-medium mb-3">Cargar resultado</h3>
                <form onSubmit={cargarResultado} className="space-y-2">
                    <input
                        required
                        value={partidoId}
                        onChange={e => setPartidoId(e.target.value)}
                        placeholder="ID del partido"
                        type="number"
                        min="1"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            required
                            value={golesA}
                            onChange={e => setGolesA(e.target.value)}
                            placeholder="Goles A"
                            type="number"
                            min="0"
                            className="border rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                            required
                            value={golesB}
                            onChange={e => setGolesB(e.target.value)}
                            placeholder="Goles B"
                            type="number"
                            min="0"
                            className="border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Guardar y calcular puntos</button>
                </form>
            </div>
        </div>
    )
}