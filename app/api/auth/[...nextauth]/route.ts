import NextAuth, { NextAuthOptions } from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { supabaseAdmin } from '@/lib/supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: {
        host: 'smtp.resend.com',
        port: 465,
        auth: {
          user: 'resend',
          pass: process.env.RESEND_API_KEY,
        },
      },
      from: process.env.RESEND_FROM_EMAIL,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      const db = supabaseAdmin()
      // Verificar que el usuario fue invitado (existe en profiles)
      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .single()
      return !!data
    },
    async session({ session }) {
      if (!session.user?.email) return session
      const db = supabaseAdmin()
      const { data } = await db
        .from('profiles')
        .select('id, nombre, es_admin')
        .eq('email', session.user.email)
        .single()
      if (data) {
        session.user.id = data.id
        session.user.name = data.nombre
        ;(session.user as any).esAdmin = data.es_admin
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verificar=1',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
