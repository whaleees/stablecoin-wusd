'use client'

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ExplorerLink } from '../cluster/cluster-ui'
import { AccountButtons, AccountTokens, AccountTransactions, useGetBalance } from './account-ui'
import { ellipsify } from '@/lib/utils'
import { Wallet, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function AccountDetailFeature() {
  const params = useParams()
  const address = useMemo(() => {
    if (!params.address) {
      return
    }
    try {
      return new PublicKey(params.address)
    } catch (e) {
      console.log(`Invalid public key`, e)
    }
  }, [params])

  if (!address) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500">Error loading account</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <AccountHeader address={address} />
      <AccountTokens address={address} />
      <AccountTransactions address={address} />
    </div>
  )
}

function AccountHeader({ address }: { address: PublicKey }) {
  const query = useGetBalance({ address })
  const balance = query.data ? (query.data / LAMPORTS_PER_SOL) : 0

  const copyAddress = () => {
    navigator.clipboard.writeText(address.toString())
    toast.success('Address copied!')
  }

  return (
    <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-3xl p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-neutral-400 text-sm mb-1">Wallet Balance</p>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-4xl font-bold text-white cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => query.refetch()}
                >
                  {balance.toFixed(4)}
                </span>
                <span className="text-xl text-neutral-400">SOL</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => query.refetch()} className="border-white/20 text-white hover:bg-white/10">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <AccountButtons address={address} />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
          <span className="text-neutral-400 text-sm">Address:</span>
          <code className="text-white font-mono text-sm flex-1 truncate">{address.toString()}</code>
          <Button variant="ghost" size="icon" onClick={copyAddress} className="text-white/60 hover:text-white hover:bg-white/10">
            <Copy className="h-4 w-4" />
          </Button>
          <ExplorerLink path={`account/${address}`} label={<ExternalLink className="h-4 w-4" />} />
        </div>
      </div>
    </div>
  )
}
