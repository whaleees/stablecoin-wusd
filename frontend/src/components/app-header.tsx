'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X, Wallet, TrendingUp, Shield, User, Settings } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { ClusterUiSelect } from './cluster/cluster-ui'
import { WalletButton } from '@/components/solana/solana-provider'

const NAV_ICONS: Record<string, any> = {
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-14 justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-primary">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M8 10L11 22H13L16 14L19 22H21L24 10H22L20 18L17 10H15L12 18L10 10H8Z" fill="var(--background)" />
              <circle cx="16" cy="22" r="2" fill="var(--background)" />
            </svg>
            <span className="text-lg font-bold text-primary">WUSD</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center">
            <ul className="flex items-center gap-1">
              {links.map(({ label, path }) => {
                const Icon = NAV_ICONS[label] || TrendingUp
                const active = isActive(path)
                return (
                  <li key={path}>
                    <Link
                      href={path}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        active 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Desktop Right Section */}
          <div className="hidden md:flex items-center gap-2">
            <ClusterUiSelect />
            <WalletButton />
            <ThemeSelect />
          </div>

          {/* Mobile Menu Button */}
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

      {/* Mobile Menu */}
      {showMenu && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 bg-background/95 backdrop-blur-xl z-50">
          <div className="container mx-auto p-4">
            <nav className="space-y-2">
              {links.map(({ label, path }) => {
                const Icon = NAV_ICONS[label] || TrendingUp
                const active = isActive(path)
                return (
                  <Link
                    key={path}
                    href={path}
                    onClick={() => setShowMenu(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                      active 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="mt-6 pt-6 border-t border-border space-y-3">
              <WalletButton />
              <div className="flex items-center gap-3">
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
