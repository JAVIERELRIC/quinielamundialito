import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 1. Obtenemos el momento exacto actual en la zona horaria de México
    const ahoraEnMexico = obtenerFechaLocalMexico();

    // 2. Calculamos las 23:59:59.999 del día de MAÑANA en tiempo de México
    const finMananaEnMexico = obtenerFechaLocalMexico();
    finMananaEnMexico.setDate(finMananaEnMexico.getDate() + 1);
    finMananaEnMexico.setHours(23, 59, 59, 999);

    // 3. Consultamos pasándole los strings ISO exactos que Supabase entiende
    const { data: partidos, error } = await supabase
      .from('partidos')
      .select('*')
      .gte('fecha_hora', ahoraEnMexico.toISOString())
      .lte('fecha_hora', finMananaEnMexico.toISOString())
      .order('fecha_hora', { ascending: true })

    if (error) throw error

    return NextResponse.json({ ok: true, partidos })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

// 🇲🇽 Función auxiliar para calcular el tiempo real de México sin importar el servidor
function obtenerFechaLocalMexico(): Date {
  const ahora = new Date();
  // Formateamos la hora actual forzando la zona horaria de México
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Monterrey',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  
  const parts = formatter.formatToParts(ahora);
  const getPart = (type: string) => parts.find(p => p.type === type)!.value;
  
  // Construimos una fecha con el desfase real de México
  return new Date(
    `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`
  );
}