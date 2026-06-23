export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    -- Llamamos directamente a la función que creamos en Postgres
    const { data: partidos, error } = await supabase
      .rpc('obtener_partidos_hoy_manana')

    if (error) throw error

    return new NextResponse(JSON.stringify({ ok: true, partidos }), {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}