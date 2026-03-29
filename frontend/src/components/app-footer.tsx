import React from 'react'

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/45 py-5 backdrop-blur-md">
      <div className="flex w-full flex-col items-center justify-between gap-4 px-4 md:px-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="text-primary">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path d="M8 10L11 22H13L16 14L19 22H21L24 10H22L20 18L17 10H15L12 18L10 10H8Z" fill="var(--background)" />
            <circle cx="16" cy="22" r="2" fill="var(--background)" />
          </svg>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">WUSD</p>
            <p className="text-sm text-muted-foreground">Dark liquidity rails on Solana</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Built on Solana</p>
      </div>
    </footer>
  )
}
