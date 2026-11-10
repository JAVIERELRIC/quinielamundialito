import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiAuth'
import { RESET_PHRASE } from '@/lib/tournament'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({}))
  if (body.confirmation !== RESET_PHRASE) {
    return NextResponse.json({ error: `Escribe exactamente: ${RESET_PHRASE}` }, { status: 400 })
  }

  const { error: resetError } = await auth.db.rpc('reiniciar_competencia')
  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

  let page = 1
  const usersToDelete: string[] = []
  while (true) {
    const { data, error } = await auth.db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const users = data.users || []
    users.forEach(user => { if (user.id !== auth.user.id) usersToDelete.push(user.id) })
    if (users.length < 200) break
    page++
  }

  let deletedUsers = 0
  for (const userId of usersToDelete) {
    const { error: deleteError } = await auth.db.auth.admin.deleteUser(userId)
    if (!deleteError) deletedUsers++
  }

  await auth.db.from('profiles').delete().neq('id', auth.user.id)
  await auth.db.from('profiles').upsert({
    id: auth.user.id,
    nombre: auth.profile.nombre,
    email: auth.profile.email,
    es_admin: true,
  })

  return NextResponse.json({
    ok: true,
    deletedUsers,
    message: 'Se borraron participantes, picks, resultados y configuración. La cuenta administradora actual se conservó para evitar bloquear la aplicación.',
  })
}
