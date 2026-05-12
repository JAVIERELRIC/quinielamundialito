import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()
  const { data: partidos } = await db.from('partidos').select('id, goles_a, goles_b').not('goles_a', 'is', null)
  const { data: posiciones } = await db.from('posiciones').select('user_id, puntos_total, picks_correctos, picks_totales')
  const { data: profiles } = await db.from('profiles').select('id, nombre')
  const posicionesConNombre = posiciones?.map(p => ({
    ...p,
    nombre: profiles?.find((pr: any) => pr.id === p.user_id)?.nombre || 'Desconocido',
  }))
  return NextResponse.json({ resultados: partidos, posiciones: posicionesConNombre })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.esAdmin) {
    return NextResponse.json({ error: 'Solo el admin puede cargar resultados' }, { status: 403 })
  }

  const { partido_id, goles_a, goles_b } = await req.json()
  const db = supabaseAdmin()

  // Guardar resultado
  const { error } = await db
    .from('partidos')
    .update({ goles_a, goles_b, cerrado: true })
    .eq('id', partido_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Calcular puntos
  await db.rpc('calcular_puntos_partido', { p_partido_id: partido_id })

  return NextResponse.json({ ok: true })
}
