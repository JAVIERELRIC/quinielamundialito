'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MATCH_COUNT, RESET_PHRASE, ROUND_LABELS, ROUND_SHORT_LABELS } from '@/lib/tournament'

type PickOption = 'A' | 'empate' | 'B'
type Tab = 'picks' | 'tabla' | 'reglas' | 'admin'
type Profile = { id: string; nombre: string; email: string; es_admin: boolean }
type Team = { id: number; posicion: number; nombre: string }
type Match = {
  id: number; grupo: string; llave: number; equipo_a: string; equipo_b: string;
  jornada: number; fase: string; vuelta: number; fecha_hora: string | null;
  goles_a: number | null; goles_b: number | null; se_definio_penales: boolean; cerrado: boolean
}
type PickRow = {
  pick_id: string; user_id: string; partido_id: number; mi_ganador_pred: PickOption;
  goles_a_pred: number | null; goles_b_pred: number | null; predice_penales: boolean;
  goles_a_reales: number | null; goles_b_reales: number | null; puntos: number;
  acerto_ganador: number; acerto_marcador_exacto: number; acerto_tanda_penales: number; jornada: number
}
type Position = { user_id: string; nombre: string; puntos_total: number; picks_correctos: number; picks_totales: number }

export default function QuinielaPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('picks')
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [configured, setConfigured] = useState(false)
  const [round, setRound] = useState(1)
  const [rankingRound, setRankingRound] = useState(0)
  const [myRows, setMyRows] = useState<PickRow[]>([])
  const [allRows, setAllRows] = useState<PickRow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [picks, setPicks] = useState<Record<number, PickOption>>({})
  const [scores, setScores] = useState<Record<number, { a: number; b: number }>>({})
  const [penalties, setPenalties] = useState<Record<number, boolean>>({})
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [champion, setChampion] = useState<string | null>(null)
  const [championSaved, setChampionSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (!currentProfile) { await supabase.auth.signOut(); router.push('/login'); return }
    setProfile(currentProfile as Profile)

    const [matchesResult, teamsResult, configResult, mineResult, allResult, profilesResult, positionsResult, championResult] = await Promise.all([
      supabase.from('partidos').select('*').order('id'),
      supabase.from('equipos').select('*').order('posicion'),
      supabase.from('configuracion').select('configurada, campeon_real').eq('id', 1).single(),
      supabase.from('vista_picks_puntos').select('*').eq('user_id', session.user.id),
      supabase.from('vista_picks_puntos').select('*'),
      supabase.from('profiles').select('id, nombre, email, es_admin').order('nombre'),
      supabase.from('posiciones').select('*'),
      supabase.from('picks_campeon').select('equipo').eq('user_id', session.user.id).maybeSingle(),
    ])

    setMatches((matchesResult.data || []) as Match[])
    setTeams((teamsResult.data || []) as Team[])
    setConfigured(Boolean(configResult.data?.configurada))
    setMyRows((mineResult.data || []) as PickRow[])
    setAllRows((allResult.data || []) as PickRow[])
    setProfiles((profilesResult.data || []) as Profile[])
    setPositions((positionsResult.data || []) as Position[])
    setChampion(championResult.data?.equipo || null)
    setChampionSaved(Boolean(championResult.data?.equipo))

    const pickMap: Record<number, PickOption> = {}
    const scoreMap: Record<number, { a: number; b: number }> = {}
    const penaltyMap: Record<number, boolean> = {}
    ;(mineResult.data || []).forEach((row: any) => {
      pickMap[row.partido_id] = row.mi_ganador_pred
      if (row.goles_a_pred !== null && row.goles_b_pred !== null) scoreMap[row.partido_id] = { a: row.goles_a_pred, b: row.goles_b_pred }
      penaltyMap[row.partido_id] = Boolean(row.predice_penales)
    })
    setPicks(pickMap)
    setScores(scoreMap)
    setPenalties(penaltyMap)
    setPending(new Set())
    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  const selectedMatches = matches.filter(match => match.jornada === round)
  const resultByMatch = useMemo(() => new Map(myRows.map(row => [row.partido_id, row])), [myRows])
  const completed = Object.keys(picks).length
  const progress = MATCH_COUNT ? Math.round((completed / MATCH_COUNT) * 100) : 0

  function markPick(matchId: number, pick: PickOption) {
    setPicks(previous => ({ ...previous, [matchId]: pick }))
    setPending(previous => new Set(previous).add(matchId))
  }

  function markScore(matchId: number, side: 'a' | 'b', raw: string) {
    const value = raw === '' ? 0 : Math.max(0, Number(raw))
    setScores(previous => ({ ...previous, [matchId]: { a: previous[matchId]?.a ?? 0, b: previous[matchId]?.b ?? 0, [side]: value } }))
    setPending(previous => new Set(previous).add(matchId))
  }

  async function authFetch(url: string, init: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('Authorization', `Bearer ${session?.access_token || ''}`)
    return fetch(url, { ...init, headers })
  }

  async function savePicks() {
    if (!pending.size) return
    setSaving(true)
    const payload = Array.from(pending).filter(id => picks[id]).map(id => ({
      partido_id: id,
      pick: picks[id],
      goles_a_pred: scores[id]?.a ?? null,
      goles_b_pred: scores[id]?.b ?? null,
      predice_penales: penalties[id] || false,
    }))
    const response = await authFetch('/api/picks', { method: 'POST', body: JSON.stringify({ picks: payload }) })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) return showToast(`❌ ${data.error}`)
    showToast(`✅ ${data.guardados} picks guardados`)
    await loadData()
  }

  async function saveChampion(team: string) {
    if (!profile || championSaved || !team) return
    const { error } = await supabase.from('picks_campeon').insert({ user_id: profile.id, equipo: team })
    if (error) return showToast(`❌ ${error.message}`)
    setChampion(team)
    setChampionSaved(true)
    showToast(`🏆 Campeón guardado: ${team}`)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-gray-500">Cargando Liguilla MX…</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-green-700">Liga MX</p><h1 className="font-bold text-gray-900">⚽ Quiniela de la Liguilla</h1></div>
          <div className="text-right"><p className="text-xs text-gray-600">{profile?.nombre}</p><button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-700">Salir</button></div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4">
          {(['picks', 'tabla', 'reglas', ...(profile?.es_admin ? ['admin'] : [])] as Tab[]).map(item => (
            <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === item ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}>
              {item === 'picks' ? '✏️ Mis picks' : item === 'tabla' ? '🏆 Tabla' : item === 'reglas' ? '📋 Reglas' : '⚙️ Admin'}
            </button>
          ))}
        </nav>
      </header>

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-xl">{toast}</div>}

      <main className="mx-auto max-w-3xl px-4 py-5">
        {!configured && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><strong>Temporada reiniciada.</strong> El administrador debe capturar los ocho equipos en la pestaña Admin antes de abrir la quiniela.</div>}

        {tab === 'picks' && (
          <section>
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex justify-between text-sm"><span>Avance</span><strong className="text-green-700">{completed}/{MATCH_COUNT} ({progress}%)</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-green-500" style={{ width: `${progress}%` }} /></div>
            </div>

            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-900">🏆 Campeón de la Liguilla · 10 puntos</p>
              {championSaved ? <p className="text-sm text-amber-800">Tu campeón: <strong>{champion}</strong> (elección bloqueada)</p> : (
                <select disabled={!configured} defaultValue="" onChange={event => saveChampion(event.target.value)} className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm">
                  <option value="">Elige tu campeón…</option>{teams.map(team => <option key={team.id} value={team.nombre}>{team.nombre}</option>)}
                </select>
              )}
            </div>

            <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
              {Object.entries(ROUND_SHORT_LABELS).map(([value, label]) => <button key={value} onClick={() => setRound(Number(value))} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${round === Number(value) ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{label}</button>)}
            </div>

            <h2 className="mb-3 text-sm font-semibold text-gray-700">{ROUND_LABELS[round]}</h2>
            <div className="space-y-3">
              {selectedMatches.map(match => {
                const view = resultByMatch.get(match.id)
                const hasResult = match.goles_a !== null && match.goles_b !== null
                const started = Boolean(match.fecha_hora && new Date(match.fecha_hora).getTime() <= Date.now())
                const placeholder = /^(Ganador|Finalista)/.test(match.equipo_a) || /^(Ganador|Finalista)/.test(match.equipo_b)
                const locked = match.cerrado || hasResult || started || placeholder
                return <article key={match.id} className={`rounded-xl border bg-white p-4 ${pending.has(match.id) ? 'border-amber-400' : 'border-gray-200'}`}>
                  <div className="mb-3 flex items-start justify-between gap-3 text-xs text-gray-500">
                    <div><strong className="text-gray-700">#{match.id} · {match.grupo}</strong><p>{match.vuelta === 1 ? 'Ida' : 'Vuelta'}{match.fecha_hora ? ` · ${new Date(match.fecha_hora).toLocaleString('es-MX', { timeZone: 'America/Monterrey', dateStyle: 'medium', timeStyle: 'short' })}` : ' · Fecha pendiente'}</p></div>
                    {hasResult && <span className="rounded-full bg-gray-100 px-2 py-1 font-bold">{match.goles_a}–{match.goles_b}</span>}
                  </div>
                  <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-semibold"><span>{match.equipo_a}</span><span className="text-gray-300">vs</span><span className="text-right">{match.equipo_b}</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['A', 'empate', 'B'] as PickOption[]).map(option => <button key={option} disabled={locked || !configured} onClick={() => markPick(match.id, option)} className={`rounded-lg border px-2 py-2 text-xs font-medium ${picks[match.id] === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600'} disabled:cursor-not-allowed disabled:opacity-60`}>{option === 'A' ? match.equipo_a : option === 'B' ? match.equipo_b : 'Empate'}</button>)}
                  </div>
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-center gap-2"><input aria-label={`Goles de ${match.equipo_a}`} disabled={locked || !configured} type="number" min="0" max="20" value={scores[match.id]?.a ?? ''} onChange={event => markScore(match.id, 'a', event.target.value)} className="w-14 rounded-md border px-2 py-1 text-center text-sm" /><span>–</span><input aria-label={`Goles de ${match.equipo_b}`} disabled={locked || !configured} type="number" min="0" max="20" value={scores[match.id]?.b ?? ''} onChange={event => markScore(match.id, 'b', event.target.value)} className="w-14 rounded-md border px-2 py-1 text-center text-sm" /></div>
                    <p className="mt-1 text-center text-[11px] text-gray-500">Marcador exacto opcional: +1 punto</p>
                    {match.vuelta === 2 && <label className="mt-2 flex justify-center gap-2 text-xs text-gray-600"><input type="checkbox" disabled={locked || !configured} checked={penalties[match.id] || false} onChange={() => { setPenalties(previous => ({ ...previous, [match.id]: !previous[match.id] })); setPending(previous => new Set(previous).add(match.id)) }} />¿La serie se define en penales? (+1)</label>}
                  </div>
                  {hasResult && view && <p className={`mt-2 text-right text-xs font-semibold ${view.puntos > 0 ? 'text-green-700' : 'text-red-500'}`}>{view.puntos > 0 ? `+${view.puntos} puntos` : 'Sin puntos'}</p>}
                </article>
              })}
            </div>
            <button onClick={savePicks} disabled={saving || !pending.size} className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400">{saving ? 'Guardando…' : pending.size ? `Guardar ${pending.size} picks` : '✅ Todo guardado'}</button>
          </section>
        )}

        {tab === 'tabla' && <Ranking positions={positions} profiles={profiles} rows={allRows} matches={matches} round={rankingRound} setRound={setRankingRound} />}

        {tab === 'reglas' && <section className="space-y-4">
          <div className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Formato</h2><p className="text-sm text-gray-600">Ocho equipos disputan 14 partidos: cuartos de final, semifinales y final, todas las series con ida y vuelta.</p></div>
          <div className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Puntuación</h2><ul className="space-y-2 text-sm text-gray-600"><li>• Resultado correcto (local, empate o visitante): <strong>1 punto</strong>.</li><li>• Marcador exacto: <strong>+1 punto</strong>.</li><li>• Acertar que una serie se define en penales: <strong>+1 punto</strong>.</li><li>• Acertar al campeón: <strong>10 puntos</strong>.</li><li>• Los picks se bloquean al iniciar el partido o cuando el administrador lo cierra.</li></ul></div>
        </section>}

        {tab === 'admin' && profile?.es_admin && <AdminPanel matches={matches} teams={teams} configured={configured} authFetch={authFetch} reload={loadData} showToast={showToast} />}
      </main>
    </div>
  )
}

function Ranking({ positions, profiles, rows, matches, round, setRound }: { positions: Position[]; profiles: Profile[]; rows: PickRow[]; matches: Match[]; round: number; setRound: (value: number) => void }) {
  const ranking = profiles.map(profile => {
    if (round === 0) {
      const position = positions.find(item => item.user_id === profile.id)
      return { id: profile.id, name: profile.nombre, points: position?.puntos_total || 0, correct: position?.picks_correctos || 0 }
    }
    const selected = rows.filter(row => row.user_id === profile.id && row.jornada === round)
    return { id: profile.id, name: profile.nombre, points: selected.reduce((sum, row) => sum + row.puntos, 0), correct: selected.reduce((sum, row) => sum + row.acerto_ganador, 0) }
  }).sort((a, b) => b.points - a.points || b.correct - a.correct || a.name.localeCompare(b.name))

  return <section className="space-y-4">
    <div className="flex gap-1 overflow-x-auto rounded-xl border bg-white p-1"><button onClick={() => setRound(0)} className={`rounded-lg px-3 py-2 text-xs font-medium ${round === 0 ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>General</button>{Object.entries(ROUND_SHORT_LABELS).map(([value, label]) => <button key={value} onClick={() => setRound(Number(value))} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${round === Number(value) ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>{label}</button>)}</div>
    <div className="overflow-hidden rounded-xl border bg-white">{ranking.map((item, index) => <div key={item.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0"><span className="w-6 text-sm text-gray-400">{index + 1}</span><div className="flex-1"><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-gray-400">{item.correct} aciertos</p></div><strong className="text-blue-700">{item.points} pts</strong></div>)}</div>
    {round > 0 && <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-xs"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Partido</th>{profiles.map(profile => <th key={profile.id} className="px-3 py-2">{profile.nombre.split(' ')[0]}</th>)}</tr></thead><tbody>{matches.filter(match => match.jornada === round).map(match => <tr key={match.id} className="border-t"><td className="px-3 py-2 font-medium">{match.equipo_a} vs {match.equipo_b}</td>{profiles.map(profile => { const pick = rows.find(row => row.user_id === profile.id && row.partido_id === match.id); return <td key={profile.id} className="px-3 py-2 text-center">{pick?.mi_ganador_pred || '—'}</td> })}</tr>)}</tbody></table></div>}
  </section>
}

function AdminPanel({ matches, teams, configured, authFetch, reload, showToast }: { matches: Match[]; teams: Team[]; configured: boolean; authFetch: (url: string, init: RequestInit) => Promise<Response>; reload: () => Promise<void>; showToast: (message: string) => void }) {
  const [teamNames, setTeamNames] = useState<string[]>(Array.from({ length: 8 }, (_, index) => teams[index]?.nombre || ''))
  const [semifinalists, setSemifinalists] = useState<string[]>(['', '', '', ''])
  const [finalists, setFinalists] = useState<string[]>(['', ''])
  const [matchId, setMatchId] = useState('')
  const [goalsA, setGoalsA] = useState('')
  const [goalsB, setGoalsB] = useState('')
  const [penalties, setPenalties] = useState(false)
  const [scheduleId, setScheduleId] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [realChampion, setRealChampion] = useState('')
  const [resetText, setResetText] = useState('')
  const [busy, setBusy] = useState(false)

  async function post(url: string, body: object, success: string) {
    setBusy(true)
    const response = await authFetch(url, { method: 'POST', body: JSON.stringify(body) })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) { showToast(`❌ ${data.error}`); return false }
    showToast(`✅ ${success}`)
    await reload()
    return true
  }

  return <section className="space-y-4">
    <AdminCard title="1. Configurar 8 equipos y cruces" subtitle="Ordénalos del 1 (mejor sembrado) al 8. Se crearán automáticamente 14 partidos; el mejor sembrado cierra los cuartos en casa.">
      <div className="grid gap-2 sm:grid-cols-2">{teamNames.map((name, index) => <label key={index} className="flex items-center gap-2 text-xs"><span className="w-5 font-bold text-gray-500">{index + 1}</span><input value={name} onChange={event => setTeamNames(values => values.map((value, i) => i === index ? event.target.value : value))} placeholder={`Equipo ${index + 1}`} className="w-full rounded-lg border px-3 py-2 text-sm" /></label>)}</div>
      {configured && <p className="mt-2 text-xs text-red-600">Volver a configurar borra todos los picks y resultados de la competencia actual.</p>}
      <button disabled={busy} onClick={() => { if (configured && !window.confirm('Se borrarán todos los picks y resultados actuales. ¿Continuar?')) return; post('/api/admin/tournament', { action: 'setup', teams: teamNames }, 'Liguilla configurada') }} className="mt-3 w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Crear 14 partidos</button>
    </AdminCard>

    <AdminCard title="2. Cargar clasificados" subtitle="Captura las semifinales en el orden: SF1 local/visitante y SF2 local/visitante. Después captura los dos finalistas.">
      <div className="grid gap-2 sm:grid-cols-2">{semifinalists.map((value, index) => <TeamSelect key={index} label={`Semifinalista ${index + 1}`} value={value} teams={teams} onChange={next => setSemifinalists(values => values.map((item, i) => i === index ? next : item))} />)}</div>
      <button disabled={busy} onClick={() => post('/api/admin/tournament', { action: 'semifinales', teams: semifinalists }, 'Semifinales actualizadas')} className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar semifinalistas</button>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{finalists.map((value, index) => <TeamSelect key={index} label={`Finalista ${index + 1}`} value={value} teams={teams} onChange={next => setFinalists(values => values.map((item, i) => i === index ? next : item))} />)}</div>
      <button disabled={busy} onClick={() => post('/api/admin/tournament', { action: 'final', teams: finalists }, 'Final actualizada')} className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar finalistas</button>
    </AdminCard>

    <AdminCard title="3. Fechas y resultados">
      <div className="grid gap-2 sm:grid-cols-2"><MatchSelect value={scheduleId} matches={matches} onChange={setScheduleId} /><input type="datetime-local" value={scheduleDate} onChange={event => setScheduleDate(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" /></div>
      <button disabled={busy || !scheduleId || !scheduleDate} onClick={() => post('/api/admin/tournament', { action: 'schedule', partido_id: Number(scheduleId), fecha_hora: scheduleDate }, 'Fecha guardada')} className="mt-2 w-full rounded-lg border border-blue-600 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Guardar fecha</button>
      <div className="my-4 border-t" />
      <MatchSelect value={matchId} matches={matches} onChange={setMatchId} />
      <div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="0" value={goalsA} onChange={event => setGoalsA(event.target.value)} placeholder="Goles local" className="rounded-lg border px-3 py-2 text-sm" /><input type="number" min="0" value={goalsB} onChange={event => setGoalsB(event.target.value)} placeholder="Goles visitante" className="rounded-lg border px-3 py-2 text-sm" /></div>
      <label className="mt-2 flex gap-2 text-xs text-gray-600"><input type="checkbox" checked={penalties} onChange={event => setPenalties(event.target.checked)} />La serie se definió en penales</label>
      <button disabled={busy || !matchId || goalsA === '' || goalsB === ''} onClick={() => post('/api/results', { partido_id: Number(matchId), goles_a: Number(goalsA), goles_b: Number(goalsB), se_definio_penales: penalties }, 'Resultado guardado')} className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar resultado</button>
    </AdminCard>

    <AdminCard title="4. Campeón oficial">
      <TeamSelect label="Campeón" value={realChampion} teams={teams} onChange={setRealChampion} />
      <button disabled={busy} onClick={() => post('/api/admin/tournament', { action: 'champion', team: realChampion }, 'Campeón y puntos actualizados')} className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar campeón</button>
    </AdminCard>

    <AdminCard title="Invitar participante">
      <div className="grid gap-2 sm:grid-cols-2"><input value={inviteName} onChange={event => setInviteName(event.target.value)} placeholder="Nombre" className="rounded-lg border px-3 py-2 text-sm" /><input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="Correo" className="rounded-lg border px-3 py-2 text-sm" /></div>
      <button disabled={busy} onClick={async () => { const ok = await post('/api/users', { nombre: inviteName, email: inviteEmail }, 'Participante creado e invitación procesada'); if (ok) { setInviteName(''); setInviteEmail('') } }} className="mt-3 w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Invitar</button>
    </AdminCard>

    <AdminCard title="Zona de peligro" subtitle="Borra participantes, sesiones, picks, resultados, equipos y calendario. Conserva únicamente tu cuenta administradora para no bloquear el sistema.">
      <input value={resetText} onChange={event => setResetText(event.target.value)} placeholder={RESET_PHRASE} className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm" />
      <button disabled={busy || resetText !== RESET_PHRASE} onClick={async () => { if (!window.confirm('Esta acción es irreversible. ¿Deseas continuar?')) return; await post('/api/admin/reset', { confirmation: resetText }, 'Aplicación reiniciada'); setResetText('') }} className="mt-3 w-full rounded-lg bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-40">Reiniciar toda la aplicación</button>
    </AdminCard>
  </section>
}

function AdminCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <div className="rounded-xl border bg-white p-4"><h2 className="font-semibold text-gray-900">{title}</h2>{subtitle && <p className="mb-3 mt-1 text-xs text-gray-500">{subtitle}</p>} {!subtitle && <div className="mb-3" />}{children}</div>
}

function TeamSelect({ label, value, teams, onChange }: { label: string; value: string; teams: Team[]; onChange: (value: string) => void }) {
  return <label className="text-xs text-gray-500">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"><option value="">Selecciona…</option>{teams.map(team => <option key={team.id} value={team.nombre}>{team.nombre}</option>)}</select></label>
}

function MatchSelect({ value, matches, onChange }: { value: string; matches: Match[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm"><option value="">Selecciona partido…</option>{matches.map(match => <option key={match.id} value={match.id}>#{match.id} · {match.equipo_a} vs {match.equipo_b}</option>)}</select>
}
