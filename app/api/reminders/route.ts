import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: 'Resend no está configurado.' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const jornada = body.jornada ? Number(body.jornada) : null
  const { data: profiles } = await auth.db.from('profiles').select('id, nombre, email').eq('es_admin', false)
  const { data: picks } = await auth.db.from('picks').select('user_id, partido_id')
  let query = auth.db.from('partidos').select('id, jornada, equipo_a, equipo_b').eq('cerrado', false)
  if (jornada) query = query.eq('jornada', jornada)
  const { data: partidos } = await query

  const resend = new Resend(process.env.RESEND_API_KEY)
  let enviados = 0
  for (const profile of profiles || []) {
    const completados = new Set((picks || []).filter(pick => pick.user_id === profile.id).map(pick => pick.partido_id))
    const pendientes = (partidos || []).filter(partido => !completados.has(partido.id))
    if (!pendientes.length) continue
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: profile.email,
      subject: `⏰ Te faltan ${pendientes.length} picks — Quiniela Liguilla MX`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto"><h2>¡${profile.nombre}, no te quedes sin picks!</h2><ul>${pendientes.map(partido => `<li>${partido.equipo_a} vs ${partido.equipo_b}</li>`).join('')}</ul><a href="${process.env.NEXTAUTH_URL || ''}/quiniela">Llenar picks →</a></div>`,
    })
    enviados++
  }
  return NextResponse.json({ ok: true, enviados })
}
