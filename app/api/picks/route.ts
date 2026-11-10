import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.picks) || body.picks.length === 0) {
    return NextResponse.json({ error: 'No hay picks para guardar.' }, { status: 400 })
  }

  const ids = body.picks.map((pick: any) => Number(pick.partido_id))
  const { data: partidos } = await auth.db.from('partidos').select('id, cerrado, fecha_hora').in('id', ids)
  const now = Date.now()
  const bloqueados = (partidos || []).filter((match: any) => match.cerrado || (match.fecha_hora && new Date(match.fecha_hora).getTime() <= now)).map((match: any) => match.id)
  if (bloqueados.length) return NextResponse.json({ error: 'Algunos partidos ya cerraron.', bloqueados }, { status: 400 })

  const rows = body.picks.map((pick: any) => ({
    user_id: auth.user.id,
    partido_id: Number(pick.partido_id),
    pick: pick.pick,
    goles_a_pred: pick.goles_a_pred ?? null,
    goles_b_pred: pick.goles_b_pred ?? null,
    predice_penales: Boolean(pick.predice_penales),
    updated_at: new Date().toISOString(),
  }))

  const valid = rows.every((row: any) => Number.isInteger(row.partido_id) && row.partido_id >= 1 && row.partido_id <= 14 && ['A', 'empate', 'B'].includes(row.pick))
  if (!valid) return NextResponse.json({ error: 'Uno o más picks son inválidos.' }, { status: 400 })

  const { error } = await auth.db.from('picks').upsert(rows, { onConflict: 'user_id,partido_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, guardados: rows.length })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return auth.error
  const { data, error } = await auth.db.from('picks').select('*').eq('user_id', auth.user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ picks: data || [] })
}
