import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic' 



// Inicializamos el cliente de Supabase para el Servidor
// Asegúrate de que tus variables de entorno coincidan con tu archivo .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET() {
  try {
    // 1. Obtenemos la hora actual del servidor (vía UTC, usualmente 6 horas adelantada)
    const horaServidor = new Date()

    // 2. Aplicamos el reajuste manual restando las 6 horas correspondientes a México (Monterrey)
    // Esto obliga al backend de Vercel a situarse en tu mismo huso horario real
    const horaMexico = new Date(horaServidor.getTime() - (6 * 60 * 60 * 1000))

    // 3. Calculamos el inicio de HOY (00:00:00) y el fin de MAÑANA (23:59:59) en tiempo local
    const inicioHoy = new Date(horaMexico.setHours(0, 0, 0, 0)).toISOString()
    
    // Avanzamos el objeto un día completo para amarrar la agenda de mañana también
    const horaMañana = new Date(horaMexico.getTime() + (24 * 60 * 60 * 1000))
    const finMañana = new Date(horaMañana.setHours(23, 59, 59, 999)).toISOString()

    // 4. Hacemos la consulta a la tabla de partidos usando los límites de tiempo locales corregidos
    const { data: partidos, error } = await supabase
      .from('partidos')
      .select('id, grupo, equipo_a, equipo_b, jornada, fase, cerrado, fecha_hora')
      .gte('fecha_hora', inicioHoy)
      .lte('fecha_hora', finMañana)
      .order('fecha_hora', { ascending: true })

    if (error) {
      throw error
    }

    // Retornamos los partidos filtrados de forma limpia y sin caché
    return NextResponse.json({ ok: true, partidos })

  } catch (error: any) {
    console.error('Error en la API de partidos-hoy:', error.message)
    return NextResponse.json(
      { ok: false, error: 'No se pudo cargar la agenda del día' },
      { status: 500 }
    )
  }
}