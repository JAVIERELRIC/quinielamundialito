import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // 🔥 Desactiva el caché por completo en esta ruta

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// ... resto de tu código

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 1. Obtener la fecha actual del sistema
    const ahora = new Date()

    // 2. Forzar el cálculo del desfase horario de 'America/Monterrey' (México) en minutos
    const tzMty = 'America/Monterrey'
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tzMty, timeZoneName: 'longOffset' })
    const parts = formatter.formatToParts(ahora)
    const offsetString = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-06:00' // Ej: "GMT-06:00" o "GMT-05:00"
    
    // Convertir el string "GMT-06:00" a minutos (-360)
    const matches = offsetString.match(/([+-])(\d+):(\d+)/)
    let offsetMinutos = 0
    if (matches) {
      const signo = matches[1] === '+' ? 1 : -1
      const horas = parseInt(matches[2], 10)
      const minutos = parseInt(matches[3], 10)
      offsetMinutos = signo * (horas * 60 + minutos)
    } else {
      offsetMinutos = -360 // Por defecto el estándar de México central (CST)
    }

    // 3. Creamos "ahora" ajustado a la perspectiva de la hora local de México
    // Restamos el offset local del servidor y sumamos el de México para equilibrar
    const utc = ahora.getTime() + (ahora.getTimezoneOffset() * 60000)
    const fechaMexico = new Date(utc + (60000 * offsetMinutos))

    // 4. Definir los límites limpios basados en ese día de México
    const inicioHoy = new Date(fechaMexico)
    inicioHoy.setHours(0, 0, 0, 0)

    const finManana = new Date(fechaMexico)
    finManana.setDate(finManana.getDate() + 1)
    finManana.setHours(23, 59, 59, 999)

    // 5. Como Supabase guarda en UTC con formato ISO, necesitamos revertir los límites locales 
    // a marcas de tiempo UTC reales antes de enviarlos a la base de datos
    const inicioHoyUTC = new Date(inicioHoy.getTime() - (60000 * offsetMinutos)).toISOString()
    const finMananaUTC = new Date(finManana.getTime() - (60000 * offsetMinutos)).toISOString()

    // 6. Consultar a Supabase
    const { data: partidos, error } = await supabase
      .from('partidos')
      .select('*')
      .gte('fecha_hora', inicioHoyUTC)
      .lte('fecha_hora', finMananaUTC)
      .is('goles_a', null)
      .order('fecha_hora', { ascending: true })

    if (error) throw error

    return NextResponse.json({ ok: true, partidos })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}