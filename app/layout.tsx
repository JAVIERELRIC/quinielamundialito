import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quiniela de la Liguilla MX',
  description: 'Quiniela de 8 equipos y 14 partidos de la Liguilla MX',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-MX"><body>{children}</body></html>
}
