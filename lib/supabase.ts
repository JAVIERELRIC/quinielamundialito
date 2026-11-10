import { createClient } from '@supabase/supabase-js'

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const configuredAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Los placeholders permiten que Next.js compile antes de configurar Vercel.
// Las peticiones reales fallarán de forma visible hasta agregar las variables.
const supabaseUrl = configuredUrl || 'https://placeholder.supabase.co'
const supabaseAnonKey = configuredAnonKey || 'public-anon-key-placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!configuredUrl || !serviceRoleKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(configuredUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
