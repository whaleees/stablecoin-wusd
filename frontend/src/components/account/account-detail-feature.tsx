'use client'

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ExplorerLink } from '../cluster/cluster-ui'
import { AccountButtons, AccountTokens, AccountTransactions, useGetBalance } from './account-ui'
import { Wallet, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { UserPositions } from './user-positions'

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
        <p className="text-destructive">Invalid address</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AccountHeader address={address} />
      <UserPositions />
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
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Balance</p>
            <p className="text-2xl font-bold">{balance.toFixed(4)} <span className="text-muted-foreground text-lg">SOL</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => query.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <AccountButtons address={address} />
        </div>
      </div>

      <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
        <code className="text-sm flex-1 truncate text-muted-foreground">{address.toString()}</code>
        <Button variant="ghost" size="icon" onClick={copyAddress} className="h-8 w-8">
          <Copy className="h-4 w-4" />
        </Button>
        <ExplorerLink path={`account/${address}`} label={<ExternalLink className="h-4 w-4" />} />
      </div>
    </div>
  )
}
