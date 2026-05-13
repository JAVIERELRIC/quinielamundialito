import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()
  const { data: partidos } = await db.from('partidos').select('id, goles_a, goles_b').not('goles_a', 'is', null)
  const { data: posiciones } = await db.from('posiciones').select('user_id, puntos_total, picks_correctos, picks_totales')
  const { data: profiles } = await db.from('profiles').select('id, nombre')
  const posicionesConNombre = posiciones?.map((p: any) => ({
    ...p, nombre: profiles?.find((pr: any) => pr.id === p.user_id)?.nombre || '?'
  }))
  return NextResponse.json({ resultados: partidos, posiciones: posicionesConNombre })
}

export async function POST(req: NextRequest) {
  // Verificar admin via header con service role
  const { partido_id, goles_a, goles_b, admin_email } = await req.json()
  const db = supabaseAdmin()

  // Verificar que el email es admin
  const { data: profile } = await db.from('profiles').select('es_admin').eq('email', admin_email).single()
  if (!profile?.es_admin) {
    return NextResponse.json({ error: 'Solo el admin puede cargar resultados' }, { status: 403 })
  }

  const { error } = await db.from('partidos').update({ goles_a, goles_b, cerrado: true }).eq('id', partido_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.rpc('calcular_puntos_partido', { p_partido_id: partido_id })
  return NextResponse.json({ ok: true })
}
