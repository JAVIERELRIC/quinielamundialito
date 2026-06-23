import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 1. Calculamos el inicio de HOY (00:00:00) en hora local de México
    const inicioHoy = obtenerFechaLocalMexico();
    inicioHoy.setHours(0, 0, 0, 0);

    // 2. Calculamos el final de MAÑANA (23:59:59) en hora local de México
    const finManana = obtenerFechaLocalMexico();
    finManana.setDate(finManana.getDate() + 1);
    finManana.setHours(23, 59, 59, 999);

    // 3. Consultamos aplicando los candados correspondientes
    const { data: partidos, error } = await supabase
      .from('partidos')
      .select('*')
      .gte('fecha_hora', inicioHoy.toISOString())
      .lte('fecha_hora', finManana.toISOString())
      .is('goles_a', null) // 🔥 FILTRO CLAVE: Solo trae partidos que NO tengan goles cargados
      .order('fecha_hora', { ascending: true })

    if (error) throw error

    return NextResponse.json({ ok: true, partidos })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// Función para forzar la hora real de México (Monterrey/CDMX)
function obtenerFechaLocalMexico(): Date {
  const ahora = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Monterrey',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  
  const parts = formatter.formatToParts(ahora);
  const getPart = (type: string) => parts.find(p => p.type === type)!.value;
  
  return new Date(
    `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`
  );
}