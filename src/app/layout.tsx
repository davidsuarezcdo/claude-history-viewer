import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Claude History Viewer',
  description: 'Visualizador del historial de chats de Claude',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
