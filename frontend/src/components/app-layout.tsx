'use client'

import { ThemeProvider } from './theme-provider'
import { Toaster } from './ui/sonner'
import { AppHeader } from '@/components/app-header'
import React from 'react'
import { AppFooter } from '@/components/app-footer'
import { ClusterChecker } from '@/components/cluster/cluster-ui'
import { AccountChecker } from '@/components/account/account-ui'

export function AppLayout({
  children,
  links,
}: {
  children: React.ReactNode
  links: { label: string; path: string }[]
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <div className="tech-grid relative min-h-screen">
        <div className="flex min-h-screen w-full flex-col overflow-hidden">
          <AppHeader links={links} />
          <main className="w-full flex-grow px-4 pb-12 pt-8 md:px-8 md:pb-16 md:pt-10">
            <ClusterChecker>
              <AccountChecker />
            </ClusterChecker>
            {children}
          </main>
          <AppFooter />
        </div>
      </div>
      <Toaster />
    </ThemeProvider>
  )
}
