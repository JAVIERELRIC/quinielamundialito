import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/reminders — enviar recordatorio a quien tenga picks pendientes
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.esAdmin) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const { jornada } = await req.json() // jornada: 1 | 2 | 3 | null (todas)

  const db = supabaseAdmin()
  const { data: profiles } = await db.from('profiles').select('id, nombre, email')
  const { data: picks } = await db.from('picks').select('user_id, partido_id')
  const { data: partidos } = await db
    .from('partidos')
    .select('id, jornada, equipo_a, equipo_b')
    .eq('cerrado', false)

  const partidosRelevantes = jornada
    ? partidos?.filter(p => p.jornada === jornada)
    : partidos

  let enviados = 0
  for (const profile of profiles || []) {
    const misPicksIds = new Set(
      picks?.filter(p => p.user_id === profile.id).map(p => p.partido_id)
    )
    const pendientes = partidosRelevantes?.filter(p => !misPicksIds.has(p.id))

    if (!pendientes || pendientes.length === 0) continue

    const listaPartidos = pendientes
      .map(p => `<li>${p.equipo_a} vs ${p.equipo_b}</li>`)
      .join('')

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: profile.email,
      subject: `⏰ Te faltan ${pendientes.length} picks — Quiniela Mundial 2026`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#185FA5">¡${profile.nombre}, no te quedes sin picks! ⚽</h2>
          <p>Te faltan <strong>${pendientes.length} partidos</strong> por llenar${jornada ? ` de la Jornada ${jornada}` : ''}:</p>
          <ul style="color:#333;line-height:1.8">${listaPartidos}</ul>
          <a href="${process.env.NEXTAUTH_URL}/quiniela"
             style="display:inline-block;background:#185FA5;color:#fff;padding:12px 28px;
                    border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0">
            Llenar mis picks ahora →
          </a>
          <p style="color:#999;font-size:12px">Los picks cierran cuando empieza cada partido.</p>
        </div>
      `,
    })
    enviados++
  }

  return NextResponse.json({ ok: true, enviados })
}
