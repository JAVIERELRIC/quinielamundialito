import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email, nombre } = await req.json()
  const db = supabaseAdmin()

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (authError && !authError.message.includes('already been registered')) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const userId = authData?.user?.id || (await db.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id
  if (!userId) return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })

  // Crear perfil
  await db.from('profiles').upsert({ id: userId, email, nombre, es_admin: false }, { onConflict: 'id', ignoreDuplicates: true })

  // Enviar email de invitación con Resend
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: '⚽ Te invitaron a la Quiniela Mundial 2026',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1D9E75">¡Hola ${nombre}! 👋</h2>
        <p>Te invitaron a participar en la <strong>Quiniela Mundial 2026</strong>.</p>
        <p>Para entrar, ve a esta página e ingresa con tu correo:</p>
        <a href="${process.env.NEXTAUTH_URL}/login"
           style="display:inline-block;background:#1D9E75;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">
          Entrar a la quiniela →
        </a>
        <p style="color:#666;font-size:13px">Ingresa con este email (${email}) y te mandamos un link mágico para acceder sin contraseña.</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
