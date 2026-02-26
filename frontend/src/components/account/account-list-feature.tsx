'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { redirect } from 'next/navigation'
import { Wallet } from 'lucide-react'

export default function AccountListFeature() {
  const { publicKey } = useWallet()

  if (publicKey) {
    return redirect(`/account/${publicKey.toString()}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-card rounded-xl border border-border p-12 text-center max-w-md">
        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-6">
          <Wallet className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Connect Wallet</h1>
        <p className="text-muted-foreground mb-6">
          Connect your wallet to view balances and positions.
        </p>
        <WalletButton />
      </div>
    </div>
  )
}
