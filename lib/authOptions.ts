import { NextAuthOptions } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Token',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null
        const db = supabaseAdmin()
        const { data: { user }, error } = await db.auth.getUser(credentials.token)
        if (error || !user) return null
        const { data: profile } = await db
          .from('profiles')
          .select('id, nombre, email, es_admin')
          .eq('email', user.email)
          .single()
        if (!profile) return null
        return { id: profile.id, name: profile.nombre, email: profile.email, esAdmin: profile.es_admin }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.name = token.name
        ;(session.user as any).esAdmin = token.esAdmin
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.esAdmin = (user as any).esAdmin
      }
      return token
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
}
