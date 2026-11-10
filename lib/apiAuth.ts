import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function requireUser(req: NextRequest) {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const db = supabaseAdmin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Sesión inválida' }, { status: 401 }) }
  }

  const { data: profile } = await db
    .from('profiles')
    .select('id, nombre, email, es_admin')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 }) }
  }

  return { db, user, profile }
}

export async function requireAdmin(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return auth
  if (!auth.profile.es_admin) {
    return { error: NextResponse.json({ error: 'Solo el administrador puede realizar esta acción' }, { status: 403 }) }
  }
  return auth
}
