import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.esAdmin) {
    return NextResponse.json({ error: 'Solo el admin puede invitar' }, { status: 403 })
  }

  const { email, nombre } = await req.json()
  const db = supabaseAdmin()

  // Crear perfil (si no existe)
  const { error: profileError } = await db.from('profiles').upsert(
    { id: crypto.randomUUID(), email, nombre, es_admin: false },
    { onConflict: 'email', ignoreDuplicates: true }
  )

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Enviar email de invitación
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: '⚽ Te invitaron a la Quiniela Mundial 2026',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1D9E75">¡Hola ${nombre}! 👋</h2>
        <p>Te invitaron a participar en la <strong>Quiniela Mundial 2026</strong>.</p>
        <p>Para entrar, haz clic aquí:</p>
        <a href="${process.env.NEXTAUTH_URL}/login"
           style="display:inline-block;background:#1D9E75;color:#fff;padding:12px 28px;
                  border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">
          Entrar a la quiniela →
        </a>
        <p style="color:#666;font-size:13px">Ingresa con este email (${email}) y te mandamos un link mágico para acceder.</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}

// GET /api/users — obtener lista de participantes con progreso
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.esAdmin) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const db = supabaseAdmin()
  const { data: profiles } = await db.from('profiles').select('id, nombre, email')
  const { data: posiciones } = await db
    .from('posiciones')
    .select('user_id, picks_totales')

  const totalPartidos = 72
  const result = profiles?.map(p => {
    const pos = posiciones?.find(x => x.user_id === p.id)
    return {
      ...p,
      picks_llenados: pos?.picks_totales || 0,
      picks_faltantes: totalPartidos - (pos?.picks_totales || 0),
    }
  })

  return NextResponse.json({ usuarios: result })
}
