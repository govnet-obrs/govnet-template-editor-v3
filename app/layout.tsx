import type { Metadata } from 'next'
import { Nunito_Sans, Noto_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const notoSans = Noto_Sans({variable:'--font-sans'});

const nunitoSans = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito-sans' })

export const metadata: Metadata = {
  title: 'OBRS Go Template Editor',
  description: 'Go template editor for OBRS with live preview and asset management',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={notoSans.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
