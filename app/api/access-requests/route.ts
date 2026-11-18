import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/require-admin'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_STATUSES = new Set(['pendiente', 'aprobada', 'rechazada'])

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function publicMessage() {
  return NextResponse.json({
    ok: true,
    message:
      'Solicitud recibida. El administrador la revisará y recibirás un correo cuando sea aprobada.',
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      nombre?: unknown
      email?: unknown
      website?: unknown
    }

    // Campo trampa para bots. La interfaz real siempre lo envía vacío.
    if (typeof body.website === 'string' && body.website.trim()) {
      return publicMessage()
    }

    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    const email =
      typeof body.email === 'string' ? normalizeEmail(body.email) : ''

    if (nombre.length < 2 || nombre.length > 80) {
      return NextResponse.json(
        { error: 'Escribe un nombre de entre 2 y 80 caracteres.' },
        { status: 400 },
      )
    }

    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'Escribe un correo electrónico válido.' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdmin()
    const { data: existing, error: existingError } = await supabase
      .from('solicitudes_acceso')
      .select('id, estado')
      .ilike('email', email)
      .maybeSingle()

    if (existingError) {
      console.error('No se pudo consultar la solicitud:', existingError)
      return NextResponse.json(
        { error: 'No fue posible registrar la solicitud.' },
        { status: 500 },
      )
    }

    if (existing?.estado === 'pendiente' || existing?.estado === 'aprobada') {
      return publicMessage()
    }

    if (existing?.estado === 'rechazada') {
      const { error } = await supabase
        .from('solicitudes_acceso')
        .update({
          nombre,
          email,
          estado: 'pendiente',
          atendida_por: null,
          atendida_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        console.error('No se pudo reabrir la solicitud:', error)
        return NextResponse.json(
          { error: 'No fue posible registrar la solicitud.' },
          { status: 500 },
        )
      }

      return publicMessage()
    }

    const { error } = await supabase.from('solicitudes_acceso').insert({
      nombre,
      email,
      estado: 'pendiente',
    })

    if (error) {
      // Una solicitud simultánea con el mismo correo debe responder igual que
      // una solicitud aceptada, sin revelar datos de usuarios.
      if (error.code === '23505') {
        return publicMessage()
      }

      console.error('No se pudo crear la solicitud:', error)
      return NextResponse.json(
        { error: 'No fue posible registrar la solicitud.' },
        { status: 500 },
      )
    }

    return publicMessage()
  } catch (error) {
    console.error('Solicitud de acceso inválida:', error)
    return NextResponse.json(
      { error: 'La solicitud no tiene un formato válido.' },
      { status: 400 },
    )
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)

  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const requestedStatus = request.nextUrl.searchParams.get('estado') ?? 'pendiente'
  const estado = VALID_STATUSES.has(requestedStatus)
    ? requestedStatus
    : 'pendiente'

  const { data, error } = await admin.supabase
    .from('solicitudes_acceso')
    .select('id, nombre, email, estado, created_at, updated_at')
    .eq('estado', estado)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('No se pudieron cargar las solicitudes:', error)
    return NextResponse.json(
      { error: 'No fue posible cargar las solicitudes.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ solicitudes: data ?? [] })
}
