'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X, Wallet, TrendingUp, Shield, User, Settings, type LucideIcon } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { ClusterUiSelect } from './cluster/cluster-ui'
import { WalletButton } from '@/components/solana/solana-provider'

const NAV_ICONS: Record<string, LucideIcon> = {
  'Dashboard': TrendingUp,
  'Vault': Wallet,
  'Pools': Shield,
  'Admin': Settings,
  'Account': User,
}

export function AppHeader({ links = [] }: { links: { label: string; path: string }[] }) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/55 bg-background/60 backdrop-blur-2xl">
      <div className="w-full px-4 md:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className="text-primary transition-transform duration-300 group-hover:rotate-3">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M8 10L11 22H13L16 14L19 22H21L24 10H22L20 18L17 10H15L12 18L10 10H8Z" fill="var(--background)" />
              <circle cx="16" cy="22" r="2" fill="var(--background)" />
            </svg>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/75">WUSD</p>
              <p className="text-sm font-medium leading-none text-foreground/90">protocol</p>
            </div>
          </Link>

          <nav className="hidden items-center md:flex">
            <ul className="flex items-center gap-1 rounded-full border border-border/70 bg-background/30 px-2 py-1">
              {links.map(({ label, path }) => {
                const active = isActive(path)
                return (
                  <li key={path}>
                    <Link
                      href={path}
                      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                        active
                          ? 'bg-primary/90 text-primary-foreground shadow-[0_0_22px_-8px_var(--color-primary)]'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                      }`}
                    >
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <ClusterUiSelect />
            <WalletButton />
            <ThemeSelect />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setShowMenu(!showMenu)}
          >
            {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {showMenu && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="w-full p-4">
            <nav className="surface-card rise-in space-y-2 rounded-2xl p-3">
              {links.map(({ label, path }) => {
                const Icon = NAV_ICONS[label] || TrendingUp
                const active = isActive(path)
                return (
                  <Link
                    key={path}
                    href={path}
                    onClick={() => setShowMenu(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-all ${
                      active
                        ? 'bg-primary/90 text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="surface-card mt-4 space-y-3 rounded-2xl p-3">
              <div className="w-full">
                <WalletButton />
              </div>
              <div className="flex items-center justify-between gap-3">
                <ClusterUiSelect />
                <ThemeSelect />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
