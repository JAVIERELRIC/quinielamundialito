import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 🕐 CAMBIO CLAVE: "Ahorita" es nuestro punto de partida exacto
    const ahora = new Date()

    // Calculamos el final de MAÑANA (23:59:59)
    const finManana = new Date()
    finManana.setDate(finManana.getDate() + 1)
    finManana.setHours(23, 59, 59, 999)

    // Filtramos para que SOLO traiga partidos de "ahorita" en adelante
    const { data: partidos, error } = await supabase
      .from('partidos')
      .select('*')
      .gte('fecha_hora', ahora.toISOString()) // <-- Solo el futuro inmediato
      .lte('fecha_hora', finManana.toISOString())
      .order('fecha_hora', { ascending: true })

    if (error) throw error

    return NextResponse.json({ ok: true, partidos })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}