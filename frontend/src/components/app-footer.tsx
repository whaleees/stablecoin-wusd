import React from 'react'

export function AppFooter() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 py-6 mt-auto">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
            W
          </div>
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            WUSD Protocol
          </span>
        </div>
        <p className="text-neutral-500 text-xs">
          Built on Solana &bull;{' '}
          <a
            className="hover:text-emerald-500 transition-colors"
            href="https://github.com/solana-developers/create-solana-dapp"
            target="_blank"
            rel="noopener noreferrer"
          >
            create-solana-dapp
          </a>
        </p>
      </div>
    </footer>
  )
}
