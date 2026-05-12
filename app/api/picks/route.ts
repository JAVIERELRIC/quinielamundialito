import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { picks } = await req.json()
  // picks = [{ partido_id: number, pick: 'A' | 'empate' | 'B' }]

  const db = supabaseAdmin()

  // Verificar que los partidos no estén cerrados
  const ids = picks.map((p: any) => p.partido_id)
  const { data: partidos } = await db
    .from('partidos')
    .select('id, cerrado')
    .in('id', ids)

  const cerrados = partidos?.filter(p => p.cerrado).map(p => p.id) || []
  if (cerrados.length > 0) {
    return NextResponse.json({ error: 'Algunos partidos ya cerraron', cerrados }, { status: 400 })
  }

  // Upsert picks
  const rows = picks.map((p: any) => ({
    user_id: session.user.id,
    partido_id: p.partido_id,
    pick: p.pick,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await db.from('picks').upsert(rows, { onConflict: 'user_id,partido_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, guardados: rows.length })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('picks')
    .select('partido_id, pick, puntos')
    .eq('user_id', session.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ picks: data })
}
