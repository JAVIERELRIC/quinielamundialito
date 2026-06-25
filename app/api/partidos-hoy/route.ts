import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase' // Asegúrate de que esta ruta a tu cliente de Supabase sea la correcta

// 🔒 FUERZA A NEXT.JS A NO GUARDAR CACHÉ EN EL SERVIDOR
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // 1. Configuración de fechas (Alineado a tu lógica actual de inicioHoy / finMañana)
        const hoy = new Date()

        // Inicio de hoy (00:00:00)
        const inicioHoy = new Date(hoy)
        inicioHoy.setHours(0, 0, 0, 0)

        // Fin de mañana (23:59:59)
        const finMañana = new Date(hoy)
        finMañana.setDate(hoy.getDate() + 1)
        finMañana.setHours(23, 59, 59, 999)

        // 2. Consulta a Supabase con el filtro de partidos no jugados (goles_a === null)
        const { data: partidos, error } = await supabase
            .from('partidos')
            .select('id, grupo, equipo_a, equipo_b, jornada, fase, cerrado, fecha_hora')
            .is('goles_a', null) // 🎯 Excluye partidos que ya jugaron o ya tienen marcador cargado
            .gte('fecha_hora', inicioHoy.toISOString())
            .lte('fecha_hora', finMañana.toISOString())
            .order('fecha_hora', { ascending: true })

        if (error) {
            throw error
        }

        // 3. Retorno con deshabilitación estricta de caché a nivel Navegador (Client-side)
        return new NextResponse(
            JSON.stringify({ ok: true, partidos: partidos || [] }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            }
        )

    } catch (error: any) {
        console.error('Error en API partidos-hoy:', error)
        return NextResponse.json(
            { ok: false, error: error.message || 'Error interno del servidor' },
            { status: 500 }
        )
    }
}