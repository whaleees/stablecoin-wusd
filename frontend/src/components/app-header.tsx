'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X, Wallet, TrendingUp, Landmark, Shield, User, Settings } from 'lucide-react'
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
    <header className="sticky top-0 z-50 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
              W
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
              WUSD
            </span>
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
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        active 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
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
          <div className="hidden md:flex items-center gap-3">
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
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl z-50">
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
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
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
