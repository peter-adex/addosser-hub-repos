<<<<<<< HEAD
import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

import { SyncProvider } from '@/components/providers/SyncProvider'
import ChunkErrorRecovery from '@/components/providers/ChunkErrorRecovery'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

export const metadata: Metadata = {
  title: { default: 'Addosser Enterprise Hub', template: '%s | Addosser Hub' },
  description:
    'Enterprise management hub for Addosser Microfinance Bank and its subsidiaries',
  icons: { icon: '/logo.png' }
}

export default async function RootLayout ({
  children
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans`}>
        <SessionProvider session={session}>
          <ThemeProvider attribute='class' defaultTheme='light' enableSystem>
            <ChunkErrorRecovery />
            <SyncProvider>{children}</SyncProvider>
=======
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: { default: "Addosser Enterprise Hub", template: "%s | Addosser Hub" },
  description: "Enterprise management hub for Addosser Microfinance Bank and its subsidiaries",
  icons: { icon: "/logo.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans`}>
        <SessionProvider session={session}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            {children}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
            <Toaster />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
<<<<<<< HEAD
  )
}

=======
  );
}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
