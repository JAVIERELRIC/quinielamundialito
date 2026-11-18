import 'server-only'

import { createClient } from '@supabase/supabase-js'

function requiredEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`)
  }

  return value
}

export function createSupabaseAdmin() {
  return createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export function createSupabaseMailClient() {
  return createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
