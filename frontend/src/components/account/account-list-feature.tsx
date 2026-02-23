'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { redirect } from 'next/navigation'
import { Wallet, ArrowRight } from 'lucide-react'

export default function AccountListFeature() {
  const { publicKey } = useWallet()

  if (publicKey) {
    return redirect(`/account/${publicKey.toString()}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-12 border border-neutral-200 dark:border-neutral-800 text-center max-w-md">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
          <Wallet className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Connect Your Wallet</h1>
        <p className="text-neutral-500 mb-8">
          Connect your wallet to view your token holdings, transaction history, and manage your assets.
        </p>
        <WalletButton />
      </div>
    </div>
  )
}
