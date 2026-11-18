import { NextRequest } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type AdminContext = {
  adminId: string
  supabase: ReturnType<typeof createSupabaseAdmin>
}

export async function requireAdmin(
  request: NextRequest,
): Promise<AdminContext | null> {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice('Bearer '.length).trim()
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, es_admin, activo')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError || !profile?.es_admin || profile.activo === false) {
    return null
  }

  return {
    adminId: data.user.id,
    supabase,
  }
}
