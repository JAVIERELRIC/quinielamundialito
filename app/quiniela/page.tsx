'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type Tab = 'picks' | 'tabla' | 'reglas' | 'admin'
type PickChoice = 'A' | 'empate' | 'B'
type Phase = 'cuartos' | 'semifinales' | 'final'
type Notice = { type: 'success' | 'error'; text: string } | null

type Profile = {
  id: string
  nombre: string
  email: string
  es_admin: boolean
}

type Configuration = {
  id: number
  configurada: boolean
  campeon_real: string | null
}

type Team = {
  id: number
  posicion: number
  nombre: string
}

type Match = {
  id: number
  grupo: string
  llave: number
  equipo_a: string
  equipo_b: string
  jornada: number
  fase: Phase
  vuelta: 1 | 2
  puntos_valor: number
  fecha_hora: string | null
  goles_a: number | null
  goles_b: number | null
  se_definio_penales: boolean
  cerrado: boolean
}

type StoredPick = {
  id: string
  user_id: string
  partido_id: number
  pick: PickChoice
  goles_a_pred: number | null
  goles_b_pred: number | null
  predice_penales: boolean
}

type ChampionPick = {
  id: string
  user_id: string
  equipo: string
  puntos: number
}

type PositionRow = {
  user_id: string
  nombre: string
  puntos_total: number
  picks_correctos: number
  picks_totales: number
}

type PointsRow = {
  pick_id: string
  user_id: string
  partido_id: number
  jornada: number
  fase: Phase
  acerto_ganador: number
  acerto_marcador_exacto: number
  acerto_tanda_penales: number
  puntos: number
}

type ScoreDraft = { a: number | null; b: number | null }
type ResultDraft = ScoreDraft & { penalties: boolean }

type RankingItem = {
  id: string
  name: string
  points: number
  correct: number
  exact: number
  finalPoints: number
  position: number
}

const ROUND_LABELS: Record<number, string> = {
  0: 'General',
  1: 'Cuartos · Ida',
  2: 'Cuartos · Vuelta',
  3: 'Semifinales · Ida',
  4: 'Semifinales · Vuelta',
  5: 'Final · Ida',
  6: 'Final · Vuelta',
}

const EMPTY_RESULT: ResultDraft = { a: null, b: null, penalties: false }

function asNonNegativeInteger(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function formatKickoff(value: string | null) {
  if (!value) return 'Fecha pendiente'

  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Monterrey',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function isPlaceholder(match: Match) {
  const names = [match.equipo_a, match.equipo_b]
  return names.some(
    name =>
      name.startsWith('Ganador ') ||
      name.startsWith('Finalista ') ||
      /^Equipo [1-8]$/.test(name),
  )
}

function hasResult(match: Match) {
  return match.goles_a !== null && match.goles_b !== null
}

function hasStarted(match: Match) {
  return Boolean(
    match.fecha_hora && new Date(match.fecha_hora).getTime() <= Date.now(),
  )
}

function isLocked(match: Match, configured: boolean) {
  return (
    !configured ||
    match.cerrado ||
    hasResult(match) ||
    hasStarted(match) ||
    isPlaceholder(match)
  )
}

function sameRankingCriteria(a: RankingItem, b: RankingItem) {
  return (
    a.points === b.points &&
    a.correct === b.correct &&
    a.exact === b.exact &&
    a.finalPoints === b.finalPoints
  )
}

function Ranking({
  profiles,
  positions,
  rows,
  round,
  tournamentFinished,
}: {
  profiles: Profile[]
  positions: PositionRow[]
  rows: PointsRow[]
  round: number
  tournamentFinished: boolean
}) {
  const ranked = useMemo(() => {
    const positionByUser = new Map(positions.map(position => [position.user_id, position]))

    const rankingWithoutPositions: Omit<RankingItem, 'position'>[] = profiles
      .map(profile => {
        const userRows = rows.filter(row => row.user_id === profile.id)

        if (round === 0) {
          const position = positionByUser.get(profile.id)
          const exact = userRows.reduce(
            (sum, row) => sum + Number(row.acerto_marcador_exacto || 0),
            0,
          )
          const finalPoints = userRows
            .filter(row => row.jornada === 5 || row.jornada === 6)
            .reduce((sum, row) => sum + Number(row.puntos || 0), 0)

          return {
            id: profile.id,
            name: profile.nombre,
            points: Number(position?.puntos_total || 0),
            correct: Number(position?.picks_correctos || 0),
            exact,
            finalPoints,
          }
        }

        const roundRows = userRows.filter(row => row.jornada === round)
        return {
          id: profile.id,
          name: profile.nombre,
          points: roundRows.reduce((sum, row) => sum + Number(row.puntos || 0), 0),
          correct: roundRows.reduce(
            (sum, row) => sum + Number(row.acerto_ganador || 0),
            0,
          ),
          exact: roundRows.reduce(
            (sum, row) => sum + Number(row.acerto_marcador_exacto || 0),
            0,
          ),
          finalPoints:
            round === 5 || round === 6
              ? roundRows.reduce((sum, row) => sum + Number(row.puntos || 0), 0)
              : 0,
        }
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.correct - a.correct ||
          b.exact - a.exact ||
          b.finalPoints - a.finalPoints,
      )

    let lastPosition = 0
    return rankingWithoutPositions.map((item, index, ranking) => {
      const previous = ranking[index - 1]
      const tied = Boolean(previous && sameRankingCriteria(item as RankingItem, previous as RankingItem))
      if (!tied) lastPosition = index + 1
      return { ...item, position: lastPosition }
    })
  }, [positions, profiles, round, rows])

  const leaders = ranked.filter(item => item.position === 1)

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        Todavía no hay participantes para mostrar.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-center">Pos.</th>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3 text-center">Puntos</th>
              <th className="px-4 py-3 text-center">Resultados</th>
              <th className="px-4 py-3 text-center">Exactos</th>
              {round === 0 && (
                <th className="px-4 py-3 text-center">Pts. Final</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ranked.map(item => {
              const sharedLead = leaders.length > 1 && item.position === 1
              const medal =
                item.position === 1 ? '🥇' : item.position === 2 ? '🥈' : item.position === 3 ? '🥉' : ''

              return (
                <tr key={item.id} className={item.position === 1 ? 'bg-amber-50/60' : ''}>
                  <td className="whitespace-nowrap px-4 py-4 text-center font-bold text-gray-800">
                    <span className="mr-1">{medal}</span>
                    {item.position}
                  </td>
                  <td className="px-4 py-4 font-semibold text-gray-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.name}</span>
                      {round === 0 && sharedLead && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          {tournamentFinished ? 'Co-campeón' : 'Co-líder'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-lg font-black text-emerald-700">
                    {item.points}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">{item.correct}</td>
                  <td className="px-4 py-4 text-center text-gray-700">{item.exact}</td>
                  {round === 0 && (
                    <td className="px-4 py-4 text-center text-gray-700">{item.finalPoints}</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
        Orden: puntos totales → resultados correctos → marcadores exactos → puntos en los dos partidos de la Final. Un empate total conserva la misma posición.
      </div>
    </div>
  )
}

export default function QuinielaPage() {
  const router = useRouter()
  
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tab, setTab] = useState<Tab>('picks')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [configuration, setConfiguration] = useState<Configuration>({
    id: 1,
    configurada: false,
    campeon_real: null,
  })
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [positions, setPositions] = useState<PositionRow[]>([])
  const [allRows, setAllRows] = useState<PointsRow[]>([])
  const [championPick, setChampionPick] = useState<ChampionPick | null>(null)
  const [championSelection, setChampionSelection] = useState('')

  const [picks, setPicks] = useState<Record<number, PickChoice>>({})
  const [scores, setScores] = useState<Record<number, ScoreDraft>>({})
  const [penalties, setPenalties] = useState<Record<number, boolean>>({})
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [round, setRound] = useState(0)

  const [setupTeams, setSetupTeams] = useState<string[]>(Array(8).fill(''))
  const [semifinalists, setSemifinalists] = useState<string[]>(Array(4).fill(''))
  const [finalists, setFinalists] = useState<string[]>(Array(2).fill(''))
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<number, string>>({})
  const [resultDrafts, setResultDrafts] = useState<Record<number, ResultDraft>>({})
  const [officialChampion, setOfficialChampion] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')

  const notify = useCallback((type: 'success' | 'error', text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice({ type, text })
    noticeTimer.current = setTimeout(() => setNotice(null), 4_500)
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    }
  }, [])

  const apiFetch = useCallback(
    async <T,>(url: string, body: unknown): Promise<T> => {
      const { data } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (data.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.message || 'No se pudo completar la operación.')
      }

      return payload as T
    },
    [supabase],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const [
        profileResponse,
        profilesResponse,
        configurationResponse,
        teamsResponse,
        matchesResponse,
        picksResponse,
        championResponse,
        positionsResponse,
        pointsResponse,
      ] = await Promise.all([
        supabase.from('profiles').select('id,nombre,email,es_admin').eq('id', user.id).single(),
        supabase.from('profiles').select('id,nombre,email,es_admin').order('created_at'),
        supabase.from('configuracion').select('id,configurada,campeon_real').eq('id', 1).single(),
        supabase.from('equipos').select('id,posicion,nombre').order('posicion'),
        supabase.from('partidos').select('*').order('id'),
        supabase.from('picks').select('*').eq('user_id', user.id),
        supabase.from('picks_campeon').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('posiciones').select('*'),
        supabase.from('vista_picks_puntos').select('*'),
      ])

      const firstError = [
        profileResponse.error,
        profilesResponse.error,
        configurationResponse.error,
        teamsResponse.error,
        matchesResponse.error,
        picksResponse.error,
        championResponse.error,
        positionsResponse.error,
        pointsResponse.error,
      ].find(Boolean)

      if (firstError) throw firstError

      const loadedProfile = profileResponse.data as Profile
      const loadedProfiles = (profilesResponse.data || []) as Profile[]
      const loadedConfiguration = configurationResponse.data as Configuration
      const loadedTeams = (teamsResponse.data || []) as Team[]
      const loadedMatches = (matchesResponse.data || []) as Match[]
      const loadedPicks = (picksResponse.data || []) as StoredPick[]

      setProfile(loadedProfile)
      setProfiles(loadedProfiles)
      setConfiguration(loadedConfiguration)
      setTeams(loadedTeams)
      setMatches(loadedMatches)
      setChampionPick((championResponse.data as ChampionPick | null) || null)
      setChampionSelection(
        ((championResponse.data as ChampionPick | null)?.equipo) || '',
      )
      setPositions((positionsResponse.data || []) as PositionRow[])
      setAllRows((pointsResponse.data || []) as PointsRow[])
      setOfficialChampion(loadedConfiguration.campeon_real || '')

      if (loadedTeams.length === 8) {
        setSetupTeams(loadedTeams.map(team => team.nombre))
      }

      const loadedPickMap: Record<number, PickChoice> = {}
      const loadedScoreMap: Record<number, ScoreDraft> = {}
      const loadedPenaltyMap: Record<number, boolean> = {}
      const matchById = new Map(loadedMatches.map(match => [match.id, match]))

      for (const pick of loadedPicks) {
        loadedPickMap[pick.partido_id] = pick.pick
        loadedScoreMap[pick.partido_id] = {
          a: pick.goles_a_pred,
          b: pick.goles_b_pred,
        }
        const match = matchById.get(pick.partido_id)
        loadedPenaltyMap[pick.partido_id] = Boolean(
          pick.predice_penales && match?.fase === 'final' && match.vuelta === 2,
        )
      }

      setPicks(loadedPickMap)
      setScores(loadedScoreMap)
      setPenalties(loadedPenaltyMap)
      setPending(new Set())

      const loadedSchedules: Record<number, string> = {}
      const loadedResults: Record<number, ResultDraft> = {}
      for (const match of loadedMatches) {
        loadedSchedules[match.id] = toDateTimeLocal(match.fecha_hora)
        loadedResults[match.id] = {
          a: match.goles_a,
          b: match.goles_b,
          penalties:
            match.fase === 'final' && match.vuelta === 2
              ? match.se_definio_penales
              : false,
        }
      }
      setScheduleDrafts(loadedSchedules)
      setResultDrafts(loadedResults)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudo cargar la quiniela.')
    } finally {
      setLoading(false)
    }
  }, [notify, router, supabase])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  function markPending(matchId: number) {
    setPending(previous => {
      const next = new Set(previous)
      next.add(matchId)
      return next
    })
  }

  function markPick(matchId: number, choice: PickChoice) {
    setPicks(previous => ({ ...previous, [matchId]: choice }))
    markPending(matchId)
  }

  function updateScore(matchId: number, side: 'a' | 'b', value: string) {
    setScores(previous => ({
      ...previous,
      [matchId]: {
        a: previous[matchId]?.a ?? null,
        b: previous[matchId]?.b ?? null,
        [side]: asNonNegativeInteger(value),
      },
    }))
    markPending(matchId)
  }

  async function savePicks() {
    const payload = Array.from(pending)
      .filter(id => picks[id])
      .map(id => {
        const match = matches.find(item => item.id === id)
        return {
          partido_id: id,
          pick: picks[id],
          goles_a_pred: scores[id]?.a ?? null,
          goles_b_pred: scores[id]?.b ?? null,
          predice_penales: Boolean(
            match?.fase === 'final' && match.vuelta === 2 && penalties[id],
          ),
        }
      })

    if (payload.length === 0) {
      notify('error', 'Selecciona un resultado antes de guardar.')
      return
    }

    setSaving(true)
    try {
      await apiFetch<{ ok: boolean; guardados: number }>('/api/picks', { picks: payload })
      setPending(new Set())
      notify('success', `${payload.length} pick${payload.length === 1 ? '' : 's'} guardado${payload.length === 1 ? '' : 's'}.`)
      await loadAll()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudieron guardar los picks.')
    } finally {
      setSaving(false)
    }
  }

  async function saveChampionPick() {
    if (!championSelection) {
      notify('error', 'Selecciona un equipo campeón.')
      return
    }
    if (configuration.campeon_real) {
      notify('error', 'La selección de campeón ya está cerrada.')
      return
    }
    if (championPick) {
      notify('error', 'Tu pick de campeón ya quedó registrado y no puede modificarse.')
      return
    }

    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.')

      const { error } = await supabase.from('picks_campeon').insert({
        user_id: user.id,
        equipo: championSelection,
        puntos: 0,
      })
      if (error) throw error

      notify('success', 'Pick de campeón guardado.')
      await loadAll()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudo guardar el campeón.')
    } finally {
      setSaving(false)
    }
  }

  async function adminAction(
    action: 'setup' | 'semifinales' | 'final',
    selectedTeams: string[],
    successMessage: string,
  ) {
    setSaving(true)
    try {
      await apiFetch('/api/admin/tournament', { action, teams: selectedTeams })
      notify('success', successMessage)
      await loadAll()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudo actualizar la liguilla.')
    } finally {
      setSaving(false)
    }
  }

  async function saveSchedule(matchId: number) {
    const value = scheduleDrafts[matchId]
    if (!value) {
      notify('error', 'Captura una fecha y hora válidas.')
      return
    }

    setSaving(true)
    try {
      await apiFetch('/api/admin/tournament', {
        action: 'schedule',
        partido_id: matchId,
        fecha_hora: new Date(value).toISOString(),
      })
      notify('success', `Fecha del partido #${matchId} guardada.`)
      await loadAll()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudo guardar la fecha.')
    } finally {
      setSaving(false)
    }
  }

  async function saveResult(match: Match) {
    const draft = resultDrafts[match.id] || EMPTY_RESULT
    if (draft.a === null || draft.b === null) {
      notify('error', 'Captura ambos marcadores.')
      return
    }

    setSaving(true)
    try {
      await apiFetch('/api/results', {
        partido_id: match.id,
        goles_a: draft.a,
        goles_b: draft.b,
        se_definio_penales: Boolean(
          match.fase === 'final' && match.vuelta === 2 && draft.penalties,
        ),
      })
      notify('success', `Resultado del partido #${match.id} guardado.`)
      await loadAll()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudo guardar el resultado.')
    } finally {
      setSaving(false)
    }
  }

  async function saveOfficialChampion() {
    if (!officialChampion) {
      notify('error', 'Selecciona al campeón oficial.')
      return
    }

    setSaving(true)
    try {
      await apiFetch('/api/admin/tournament', {
        action: 'champion',
        team: officialChampion,
      })
      notify('success', 'Campeón oficial y puntos actualizados.')
      await loadAll()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudo guardar el campeón.')
    } finally {
      setSaving(false)
    }
  }

  async function inviteParticipant() {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      notify('error', 'Captura nombre y correo del participante.')
      return
    }

    setSaving(true)
    try {
      await apiFetch('/api/users', {
        nombre: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
      })
      setInviteName('')
      setInviteEmail('')
      notify('success', 'Invitación procesada correctamente.')
      await loadAll()
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'No se pudo enviar la invitación.')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const configured = configuration.configurada
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => a.id - b.id),
    [matches],
  )

  if (loading && !profile) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-gray-500">
          Cargando quiniela…
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-start justify-between px-4 py-3 sm:px-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Liga MX
            </div>
            <h1 className="mt-1 text-lg font-black">⚽ Quiniela de la Liguilla</h1>
          </div>
          <div className="text-right text-xs">
            <div className="font-medium text-gray-700">{profile?.nombre}</div>
            <button className="mt-1 text-gray-500 hover:text-gray-900" onClick={() => void signOut()}>
              Salir
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          {([
            ['picks', '📝 Mis picks'],
            ['tabla', '🏆 Tabla'],
            ['reglas', '📋 Reglas'],
            ...(profile?.es_admin ? ([['admin', '⚙️ Admin']] as const) : []),
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === value
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {tab === 'picks' && (
          <section className="space-y-5">
            {!configured && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <strong>Temporada reiniciada.</strong> El administrador debe capturar los ocho equipos antes de abrir la quiniela.
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-bold">🏆 Tu campeón</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Acertar al campeón de la Liguilla vale 10 puntos.
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <select
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:w-64"
                    value={championPick?.equipo || championSelection}
                    disabled={!configured || Boolean(championPick) || Boolean(configuration.campeon_real) || saving}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setChampionSelection(event.target.value)
                    }
                  >
                    <option value="">Selecciona…</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.nombre}>
                        {team.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!configured || Boolean(championPick) || Boolean(configuration.campeon_real) || saving}
                    onClick={() => void saveChampionPick()}
                  >
                    {championPick ? 'Guardado' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>

            {sortedMatches.map(match => {
              const locked = isLocked(match, configured)
              const resultAvailable = hasResult(match)
              const matchScore = scores[match.id] || { a: null, b: null }
              const choice = picks[match.id]
              const isFinalSecondLeg = match.fase === 'final' && match.vuelta === 2

              return (
                <article key={match.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">#{match.id} · {match.grupo}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {match.vuelta === 1 ? 'Ida' : 'Vuelta'} · {formatKickoff(match.fecha_hora)}
                      </div>
                    </div>
                    {locked && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                        🔒 Cerrado
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <div className="font-bold uppercase">{match.equipo_a}</div>
                    <div className="text-xs font-bold text-gray-300">VS</div>
                    <div className="font-bold uppercase">{match.equipo_b}</div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {([
                      ['A', match.equipo_a],
                      ['empate', 'Empate'],
                      ['B', match.equipo_b],
                    ] as [PickChoice, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        disabled={locked}
                        onClick={() => markPick(match.id, value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          choice === value
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-emerald-500'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl bg-gray-50 px-4 py-4 text-center">
                    {resultAvailable && (
                      <div className="mb-3 text-xs font-bold text-emerald-700">
                        Resultado oficial: {match.goles_a} - {match.goles_b}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <input
                        aria-label={`Goles de ${match.equipo_a}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        disabled={locked || !choice}
                        value={matchScore.a ?? ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateScore(match.id, 'a', event.target.value)
                        }
                        className="w-14 rounded-lg border border-gray-300 bg-white px-2 py-2 text-center text-sm disabled:opacity-60"
                      />
                      <span className="font-bold text-gray-500">–</span>
                      <input
                        aria-label={`Goles de ${match.equipo_b}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        disabled={locked || !choice}
                        value={matchScore.b ?? ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          updateScore(match.id, 'b', event.target.value)
                        }
                        className="w-14 rounded-lg border border-gray-300 bg-white px-2 py-2 text-center text-sm disabled:opacity-60"
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Marcador exacto opcional: +1 punto</div>

                    {isFinalSecondLeg && (
                      <label className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          disabled={locked || !choice}
                          checked={penalties[match.id] || false}
                          onChange={() => {
                            setPenalties(previous => ({
                              ...previous,
                              [match.id]: !previous[match.id],
                            }))
                            markPending(match.id)
                          }}
                        />
                        ¿La Final se define en penales? (+1)
                      </label>
                    )}
                  </div>
                </article>
              )
            })}

            <button
              className="sticky bottom-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending.size === 0 || saving}
              onClick={() => void savePicks()}
            >
              {saving
                ? 'Guardando…'
                : pending.size > 0
                  ? `Guardar ${pending.size} pick${pending.size === 1 ? '' : 's'}`
                  : '✅ Todo guardado'}
            </button>
          </section>
        )}

        {tab === 'tabla' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-black">Tabla de posiciones</h2>
              <p className="mt-1 text-sm text-gray-500">Consulta la clasificación general o por jornada.</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {Object.entries(ROUND_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setRound(Number(value))}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${
                    round === Number(value)
                      ? 'bg-emerald-600 text-white'
                      : 'border border-gray-300 bg-white text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Ranking
              profiles={profiles}
              positions={positions}
              rows={allRows}
              round={round}
              tournamentFinished={Boolean(configuration.campeon_real)}
            />
          </section>
        )}

        {tab === 'reglas' && (
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-black">Reglas de la quiniela</h2>
              <p className="mt-1 text-sm text-gray-500">Formato, puntuación y criterios definitivos.</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold">⚽ Formato</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                <li>• Participan 8 equipos y se pronostican 14 partidos.</li>
                <li>• Cuartos de Final: 8 partidos; Semifinales: 4; Final: 2. Todas las series son de ida y vuelta.</li>
                <li>• Cada partido puntúa de forma independiente.</li>
                <li>• Los picks se bloquean automáticamente al llegar la fecha y hora de inicio, o cuando el resultado queda cerrado.</li>
                <li>• En Cuartos y Semifinales, si el marcador global termina empatado, avanza el equipo mejor ubicado en la tabla general.</li>
                <li>• En la Final desaparece la ventaja por posición; si el empate global persiste, puede definirse en penales.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold">🎯 Puntuación</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                <li>• Acertar ganador o empate: <strong>1 punto</strong>.</li>
                <li>• Acertar el marcador exacto: <strong>+1 punto adicional</strong>.</li>
                <li>• Solo en la vuelta de la Final, acertar que la serie se define en penales: <strong>+1 punto adicional</strong>.</li>
                <li>• Acertar al campeón de la Liguilla: <strong>10 puntos</strong>.</li>
                <li>• En Cuartos y Semifinales no existe pronóstico de penales.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold">🏆 Desempates</h3>
              <p className="mt-3 text-sm text-gray-700">En caso de empate en puntos, se aplican estos criterios en orden:</p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                <li><strong>1.</strong> Mayor número de resultados correctos.</li>
                <li><strong>2.</strong> Mayor número de marcadores exactos.</li>
                <li><strong>3.</strong> Mayor cantidad de puntos obtenidos en los dos partidos de la Final.</li>
                <li><strong>4.</strong> Si el empate continúa, los participantes comparten la posición y, si empatan en el primer lugar al finalizar la Liguilla, son declarados co-campeones.</li>
              </ol>
              <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                El orden alfabético no se utiliza como criterio deportivo de desempate.
              </p>
            </div>
          </section>
        )}

        {tab === 'admin' && profile?.es_admin && (
          <section className="space-y-5">
            {!configured && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <strong>Temporada reiniciada.</strong> Captura los ocho equipos antes de abrir la quiniela.
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-black">1. Configurar 8 equipos y cruces</h2>
              <p className="mt-1 text-xs text-gray-500">Ordénalos del 1 (mejor sembrado) al 8. El mejor sembrado cierra los Cuartos en casa.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {setupTeams.map((team, index) => (
                  <label key={index} className="flex items-center gap-2">
                    <span className="w-5 text-xs font-bold text-gray-500">{index + 1}</span>
                    <input
                      value={team}
                      maxLength={60}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setSetupTeams(previous => previous.map((item, itemIndex) => itemIndex === index ? event.target.value : item))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder={`Equipo ${index + 1}`}
                    />
                  </label>
                ))}
              </div>
              <button
                disabled={saving}
                onClick={() => void adminAction('setup', setupTeams, 'Liguilla configurada con 14 partidos.')}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Crear 14 partidos
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-black">2. Cargar clasificados</h2>
              <p className="mt-1 text-xs text-gray-500">Captura las semifinales en orden: SF1 local/visitante y SF2 local/visitante. Después captura los dos finalistas.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {semifinalists.map((value, index) => (
                  <label key={index} className="text-xs text-gray-600">
                    Semifinalista {index + 1}
                    <select
                      value={value}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => setSemifinalists(previous => previous.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                    >
                      <option value="">Selecciona…</option>
                      {teams.map(team => <option key={team.id} value={team.nombre}>{team.nombre}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <button
                disabled={saving}
                onClick={() => void adminAction('semifinales', semifinalists, 'Semifinalistas actualizados.')}
                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Guardar semifinalistas
              </button>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {finalists.map((value, index) => (
                  <label key={index} className="text-xs text-gray-600">
                    Finalista {index + 1}
                    <select
                      value={value}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => setFinalists(previous => previous.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                    >
                      <option value="">Selecciona…</option>
                      {teams.map(team => <option key={team.id} value={team.nombre}>{team.nombre}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <button
                disabled={saving}
                onClick={() => void adminAction('final', finalists, 'Finalistas actualizados.')}
                className="mt-3 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Guardar finalistas
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-black">3. Fechas y resultados</h2>
              <div className="mt-4 space-y-4">
                {sortedMatches.map(match => {
                  const draft = resultDrafts[match.id] || EMPTY_RESULT
                  const isFinalSecondLeg = match.fase === 'final' && match.vuelta === 2

                  return (
                    <div key={match.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="text-sm font-bold">#{match.id} · {match.equipo_a} vs {match.equipo_b}</div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          type="datetime-local"
                          value={scheduleDrafts[match.id] || ''}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => setScheduleDrafts(previous => ({ ...previous, [match.id]: event.target.value }))}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                        <button
                          disabled={saving}
                          onClick={() => void saveSchedule(match.id)}
                          className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Guardar fecha
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          aria-label={`Resultado de ${match.equipo_a}`}
                          type="number"
                          min={0}
                          value={draft.a ?? ''}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => setResultDrafts(previous => ({
                            ...previous,
                            [match.id]: { ...(previous[match.id] || EMPTY_RESULT), a: asNonNegativeInteger(event.target.value) },
                          }))}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
                        />
                        <span>–</span>
                        <input
                          aria-label={`Resultado de ${match.equipo_b}`}
                          type="number"
                          min={0}
                          value={draft.b ?? ''}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => setResultDrafts(previous => ({
                            ...previous,
                            [match.id]: { ...(previous[match.id] || EMPTY_RESULT), b: asNonNegativeInteger(event.target.value) },
                          }))}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
                        />
                        {isFinalSecondLeg && (
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={draft.penalties}
                              onChange={(event: ChangeEvent<HTMLInputElement>) => setResultDrafts(previous => ({
                                ...previous,
                                [match.id]: { ...(previous[match.id] || EMPTY_RESULT), penalties: event.target.checked },
                              }))}
                            />
                            Se definió en penales
                          </label>
                        )}
                        <button
                          disabled={saving}
                          onClick={() => void saveResult(match)}
                          className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Guardar resultado
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="font-black">4. Campeón oficial</h2>
                <select
                  className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                  value={officialChampion}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setOfficialChampion(event.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {teams.map(team => <option key={team.id} value={team.nombre}>{team.nombre}</option>)}
                </select>
                <button
                  disabled={saving}
                  onClick={() => void saveOfficialChampion()}
                  className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Confirmar campeón y asignar puntos
                </button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="font-black">5. Invitar participante</h2>
                <div className="mt-4 space-y-2">
                  <input
                    value={inviteName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setInviteName(event.target.value)}
                    placeholder="Nombre"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setInviteEmail(event.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <button
                  disabled={saving}
                  onClick={() => void inviteParticipant()}
                  className="mt-3 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Enviar invitación
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl ${
            notice.type === 'success' ? 'bg-emerald-700' : 'bg-slate-900'
          }`}
        >
          {notice.type === 'success' ? '✅' : '❌'} {notice.text}
        </div>
      )}
    </main>
  )
}
