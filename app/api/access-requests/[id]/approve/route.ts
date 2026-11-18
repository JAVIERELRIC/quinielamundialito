import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/require-admin'
import { createSupabaseMailClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function findUserByEmail(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>['supabase'],
  email: string,
): Promise<User | null> {
  const normalizedEmail = email.toLowerCase()

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) {
      throw error
    }

    const user = data.users.find(
      item => item.email?.toLowerCase() === normalizedEmail,
    )

    if (user) {
      return user
    }

    if (data.users.length < 1000) {
      return null
    }
  }

  throw new Error('No fue posible completar la búsqueda del usuario.')
}

function siteUrl(request: NextRequest): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(
    /\/$/,
    '',
  )
}

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

  const { data: solicitud, error: requestError } = await admin.supabase
    .from('solicitudes_acceso')
    .select('id, nombre, email, estado')
    .eq('id', id)
    .maybeSingle()

  if (requestError) {
    console.error('No se pudo consultar la solicitud:', requestError)
    return NextResponse.json(
      { error: 'No fue posible consultar la solicitud.' },
      { status: 500 },
    )
  }

  if (!solicitud) {
    return NextResponse.json(
      { error: 'La solicitud ya no existe.' },
      { status: 404 },
    )
  }

  if (solicitud.estado === 'aprobada') {
    return NextResponse.json({ ok: true, message: 'La solicitud ya estaba aprobada.' })
  }

  if (solicitud.estado !== 'pendiente') {
    return NextResponse.json(
      { error: 'Solo se pueden aprobar solicitudes pendientes.' },
      { status: 409 },
    )
  }

  let user: User | null = null
  let previousProfileWasActive = false

  try {
    user = await findUserByEmail(admin.supabase, solicitud.email)

    if (user) {
      const { error } = await admin.supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: {
          ...user.user_metadata,
          nombre: solicitud.nombre,
        },
      })

      if (error) {
        throw error
      }
    } else {
      const { data, error } = await admin.supabase.auth.admin.createUser({
        email: solicitud.email,
        email_confirm: true,
        user_metadata: { nombre: solicitud.nombre },
      })

      if (error || !data.user) {
        throw error ?? new Error('Supabase no devolvió el usuario creado.')
      }

      user = data.user
    }

    const { data: previousProfile } = await admin.supabase
      .from('profiles')
      .select('activo')
      .eq('id', user.id)
      .maybeSingle()

    previousProfileWasActive = previousProfile?.activo === true

    const { error: profileError } = await admin.supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          nombre: solicitud.nombre,
          email: solicitud.email,
          es_admin: false,
          activo: true,
        },
        { onConflict: 'id' },
      )

    if (profileError) {
      throw profileError
    }

    // Envía el mismo código OTP que utiliza el login existente.
    const mailClient = createSupabaseMailClient()
    const { error: mailError } = await mailClient.auth.signInWithOtp({
      email: solicitud.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteUrl(request)}/login`,
      },
    })

    if (mailError) {
      if (!previousProfileWasActive) {
        await admin.supabase
          .from('profiles')
          .update({ activo: false })
          .eq('id', user.id)
      }

      throw mailError
    }

    const { error: approvalError } = await admin.supabase
      .from('solicitudes_acceso')
      .update({
        estado: 'aprobada',
        atendida_por: admin.adminId,
        atendida_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('estado', 'pendiente')

    if (approvalError) {
      throw approvalError
    }

    return NextResponse.json({
      ok: true,
      message: `Se aprobó a ${solicitud.nombre} y se envió su código de acceso.`,
    })
  } catch (error) {
    console.error('No se pudo aprobar la solicitud:', error)
    return NextResponse.json(
      {
        error:
          'No fue posible completar la aprobación ni confirmar el envío del acceso. Intenta nuevamente.',
      },
      { status: 500 },
    )
  }
}
