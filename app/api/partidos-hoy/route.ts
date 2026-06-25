import { NextResponse } from 'next/server'
import { headers } from 'next/headers' // 🎯 IMPORTACIÓN CLAVE PARA DETENER EL STATIC CACHE
import { supabase } from '@/lib/supabase'

// Forzar comportamiento dinámico estricto en Next.js
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    try {
        // 1. Al llamar a headers(), Next.js sabe que esta ruta depende del cliente 
        // y la saca inmediatamente del caché estático del build.
        const headersList = await headers()

        const hoy = new Date()

        // Configuración de rangos (Horas locales / UTC según tu servidor)
        const inicioHoy = new Date(hoy)
        inicioHoy.setHours(0, 0, 0, 0)

        const finMañana = new Date(hoy)
        finMañana.setDate(hoy.getDate() + 1)
        finMañana.setHours(23, 59, 59, 999)

        // 2. Consulta limpia a Supabase
        const { data: partidos, error } = await supabase
            .from('partidos')
            .select('id, grupo, equipo_a, equipo_b, jornada, fase, cerrado, fecha_hora')
            .is('goles_a', null)
            .gte('fecha_hora', inicioHoy.toISOString())
            .lte('fecha_hora', finMañana.toISOString())
            .order('fecha_hora', { ascending: true })

        if (error) {
            throw error
        }

        // 3. Respuesta con cabeceras de control de caché agresivas para el navegador
        return new NextResponse(
            JSON.stringify({ ok: true, partidos: partidos || [] }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            }
        )

    } catch (error: any) {
        console.error('Error en API partidos-hoy:', error)
        return NextResponse.json(
            { ok: false, error: error.message || 'Error interno' },
            { status: 500 }
        )
    }
}