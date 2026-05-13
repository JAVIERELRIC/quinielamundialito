import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { jornada, admin_email } = await req.json()
  const db = supabaseAdmin()

  const { data: profile } = await db.from('profiles').select('es_admin').eq('email', admin_email).single()
  if (!profile?.es_admin) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: profiles } = await db.from('profiles').select('id, nombre, email')
  const { data: picks } = await db.from('picks').select('user_id, partido_id')
  const { data: partidos } = await db.from('partidos').select('id, jornada, equipo_a, equipo_b').eq('cerrado', false)

  const partidosRelevantes = jornada ? partidos?.filter((p: any) => p.jornada === jornada) : partidos

  let enviados = 0
  for (const p of profiles || []) {
    const misPicksIds = new Set(picks?.filter((pk: any) => pk.user_id === p.id).map((pk: any) => pk.partido_id))
    const pendientes = partidosRelevantes?.filter((pt: any) => !misPicksIds.has(pt.id))
    if (!pendientes || pendientes.length === 0) continue

    const lista = pendientes.map((pt: any) => `<li>${pt.equipo_a} vs ${pt.equipo_b}</li>`).join('')
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: p.email,
      subject: `⏰ Te faltan ${pendientes.length} picks — Quiniela Mundial 2026`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#185FA5">¡${p.nombre}, no te quedes sin picks! ⚽</h2>
        <p>Te faltan <strong>${pendientes.length} partidos</strong> por llenar:</p>
        <ul>${lista}</ul>
        <a href="${process.env.NEXTAUTH_URL}/quiniela" style="display:inline-block;background:#185FA5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0">Llenar picks →</a>
      </div>`
    })
    enviados++
  }
  return NextResponse.json({ ok: true, enviados })
}
