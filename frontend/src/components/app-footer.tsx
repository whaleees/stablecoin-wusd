import React from 'react'

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-background py-4 mt-auto">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="text-primary">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path d="M8 10L11 22H13L16 14L19 22H21L24 10H22L20 18L17 10H15L12 18L10 10H8Z" fill="var(--background)" />
            <circle cx="16" cy="22" r="2" fill="var(--background)" />
          </svg>
          <span className="text-sm font-medium text-muted-foreground">WUSD</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Built on Solana
        </p>
      </div>
    </footer>
  )
}
