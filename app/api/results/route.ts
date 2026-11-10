import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { data: partidos, error } = await auth.db
    .from('partidos')
    .select('id, goles_a, goles_b, se_definio_penales')
    .not('goles_a', 'is', null)
    .order('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resultados: partidos || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({}))
  const partidoId = Number(body.partido_id)
  const golesA = Number(body.goles_a)
  const golesB = Number(body.goles_b)
  if (!Number.isInteger(partidoId) || partidoId < 1 || partidoId > 14 || !Number.isInteger(golesA) || golesA < 0 || !Number.isInteger(golesB) || golesB < 0) {
    return NextResponse.json({ error: 'Partido o marcador inválidos.' }, { status: 400 })
  }

  const { error } = await auth.db.from('partidos').update({
    goles_a: golesA,
    goles_b: golesB,
    se_definio_penales: Boolean(body.se_definio_penales),
    cerrado: true,
  }).eq('id', partidoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
