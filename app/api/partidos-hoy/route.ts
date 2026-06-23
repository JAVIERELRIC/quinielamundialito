import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Calculamos el inicio de HOY (00:00:00) en hora local
    const inicioHoy = new Date()
    inicioHoy.setHours(0, 0, 0, 0)

    // Calculamos el final de MAÑANA (23:59:59)
    const finManana = new Date()
    finManana.setDate(finManana.getDate() + 1)
    finManana.setHours(23, 59, 59, 999)

    // Consultamos la tabla usando tu columna 'fecha_hora'
    const { data: partidos, error } = await supabase
      .from('partidos')
      .select('*')
      .gte('fecha_hora', inicioHoy.toISOString())
      .lte('fecha_hora', finManana.toISOString())
      .order('fecha_hora', { ascending: true })

    if (error) throw error

    return NextResponse.json({ ok: true, partidos })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}