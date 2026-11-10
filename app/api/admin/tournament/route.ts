import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiAuth'
import { validateTeams } from '@/lib/tournament'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  if (action === 'setup') {
    const validation = validateTeams(body.teams, 8)
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 })

    const { error } = await auth.db.rpc('configurar_liguilla', { p_equipos: validation.teams })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: 'Liguilla configurada con 8 equipos y 14 partidos.' })
  }

  if (action === 'semifinales') {
    const validation = validateTeams(body.teams, 4)
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 })
    const { error } = await auth.db.rpc('actualizar_semifinalistas', { p_equipos: validation.teams })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'final') {
    const validation = validateTeams(body.teams, 2)
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 })
    const { error } = await auth.db.rpc('actualizar_finalistas', { p_equipos: validation.teams })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'schedule') {
    const partidoId = Number(body.partido_id)
    const fechaHora = body.fecha_hora ? new Date(body.fecha_hora) : null
    if (!Number.isInteger(partidoId) || partidoId < 1 || partidoId > 14 || !fechaHora || Number.isNaN(fechaHora.getTime())) {
      return NextResponse.json({ error: 'Partido o fecha inválidos.' }, { status: 400 })
    }
    const { error } = await auth.db.from('partidos').update({ fecha_hora: fechaHora.toISOString() }).eq('id', partidoId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'champion') {
    const team = String(body.team || '').trim()
    const { data: found } = await auth.db.from('equipos').select('nombre').eq('nombre', team).maybeSingle()
    if (!found) return NextResponse.json({ error: 'El campeón debe ser uno de los 8 equipos.' }, { status: 400 })
    const { error: configError } = await auth.db.from('configuracion').update({ campeon_real: found.nombre, updated_at: new Date().toISOString() }).eq('id', 1)
    if (configError) return NextResponse.json({ error: configError.message }, { status: 500 })
    const { error: picksError } = await auth.db.from('picks_campeon').update({ puntos: 0 }).neq('equipo', found.nombre)
    if (picksError) return NextResponse.json({ error: picksError.message }, { status: 500 })
    await auth.db.from('picks_campeon').update({ puntos: 10 }).eq('equipo', found.nombre)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
}
