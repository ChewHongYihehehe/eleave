import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Manrope, Fraunces } from 'next/font/google'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
})

export const metadata: Metadata = {
  title: 'E-Leave System',
  description: 'Company leave application & approval system',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink">
        {children}
      </body>
    </html>
  )
}
