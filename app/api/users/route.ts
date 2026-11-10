import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const nombre = String(body.nombre || '').trim()
  if (!email.includes('@') || !nombre) return NextResponse.json({ error: 'Nombre y correo son obligatorios.' }, { status: 400 })

  const { data: authData, error: authError } = await auth.db.auth.admin.createUser({ email, email_confirm: true })
  if (authError && !authError.message.toLowerCase().includes('already')) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  let userId = authData?.user?.id
  if (!userId) {
    const { data } = await auth.db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    userId = data.users.find(user => user.email?.toLowerCase() === email)?.id
  }
  if (!userId) return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 500 })

  const { error: profileError } = await auth.db.from('profiles').upsert({ id: userId, email, nombre, es_admin: false })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: '⚽ Te invitaron a la Quiniela Liguilla MX',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto"><h2 style="color:#1D9E75">¡Hola ${nombre}!</h2><p>Te invitaron a participar en la <strong>Quiniela Liguilla MX</strong>.</p><a href="${process.env.NEXTAUTH_URL || ''}/login" style="display:inline-block;background:#1D9E75;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Entrar a la quiniela →</a></div>`,
    })
  }

  return NextResponse.json({ ok: true })
}
