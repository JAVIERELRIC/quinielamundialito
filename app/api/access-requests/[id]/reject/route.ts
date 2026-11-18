import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, context: unknown) {
  const admin = await requireAdmin(request)

  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const routeContext = context as {
    params: { id: string } | Promise<{ id: string }>
  }
  const { id } = await routeContext.params

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const { data, error } = await admin.supabase
    .from('solicitudes_acceso')
    .update({
      estado: 'rechazada',
      atendida_por: admin.adminId,
      atendida_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('No se pudo rechazar la solicitud:', error)
    return NextResponse.json(
      { error: 'No fue posible rechazar la solicitud.' },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: 'La solicitud ya fue atendida o no existe.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true, message: 'Solicitud rechazada.' })
}
