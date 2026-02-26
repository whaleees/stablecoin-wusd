'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { RefreshCw, Coins, Copy, ExternalLink, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useCluster } from '../cluster/cluster-data-access'
import { ExplorerLink } from '../cluster/cluster-ui'
import {
  useGetBalance,
  useGetSignatures,
  useGetTokenAccounts,
  useRequestAirdrop,
  useTransferSol,
} from './account-data-access'
import { ellipsify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AppAlert } from '@/components/app-alert'
import { AppModal } from '@/components/app-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export { useGetBalance }

export function AccountBalance({ address }: { address: PublicKey }) {
  const query = useGetBalance({ address })

  return (
    <h1 className="text-5xl font-bold cursor-pointer" onClick={() => query.refetch()}>
      {query.data ? <BalanceSol balance={query.data} /> : '...'} SOL
    </h1>
  )
}

export function AccountChecker() {
  const { publicKey } = useWallet()
  if (!publicKey) {
    return null
  }
  return <AccountBalanceCheck address={publicKey} />
}

export function AccountBalanceCheck({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  const mutation = useRequestAirdrop({ address })
  const query = useGetBalance({ address })

  if (query.isLoading) {
    return null
  }
  if (query.isError || !query.data) {
    return (
      <AppAlert
        action={
          <Button variant="outline" onClick={() => mutation.mutateAsync(1).catch((err) => console.log(err))}>
            Request Airdrop
          </Button>
        }
      >
        You are connected to <strong>{cluster.name}</strong> but your account is not found on this cluster.
      </AppAlert>
    )
  }
  return null
}

export function AccountButtons({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  return (
    <div className="flex gap-2">
      {cluster.network?.includes('mainnet') ? null : <ModalAirdrop address={address} />}
      <ModalSend address={address} />
      <ModalReceive address={address} />
    </div>
  )
}

export function AccountTokens({ address }: { address: PublicKey }) {
  const [showAll, setShowAll] = useState(false)
  const query = useGetTokenAccounts({ address })
  const client = useQueryClient()
  
  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 6)
  }, [query.data, showAll])

  const copyMint = (mint: string) => {
    navigator.clipboard.writeText(mint)
    toast.success('Mint address copied!')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Token Holdings</h2>
          <p className="text-muted-foreground text-sm">Your SPL token balances</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await query.refetch()
            await client.invalidateQueries({ queryKey: ['getTokenAccountBalance'] })
          }}
          disabled={query.isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${query.isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {query.isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500">
          Error: {query.error?.message}
        </div>
      )}

      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div className="bg-card rounded-xl p-8 border border-border text-center">
              <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">No Tokens</h3>
              <p className="text-muted-foreground text-sm">No SPL tokens in this wallet.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {items?.map(({ account, pubkey }) => {
                  const mintAddress = account.data.parsed.info.mint
                  const balance = account.data.parsed.info.tokenAmount.uiAmount ?? 0
                  const decimals = account.data.parsed.info.tokenAmount.decimals

                  return (
                    <div
                      key={pubkey.toString()}
                      className="bg-card rounded-xl p-4 border border-border hover:border-primary/50 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                          {mintAddress.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-mono text-sm">{ellipsify(mintAddress, 6)}</p>
                          <p className="text-2xl font-bold">
                            {balance.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyMint(mintAddress)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <ExplorerLink path={`account/${mintAddress}`} label={<ExternalLink className="h-4 w-4" />} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {(query.data?.length ?? 0) > 6 && (
                <div className="text-center mt-6">
                  <Button variant="outline" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Show Less' : `Show All (${query.data.length} tokens)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function AccountTransactions({ address }: { address: PublicKey }) {
  const query = useGetSignatures({ address })
  const [showAll, setShowAll] = useState(false)

  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Transactions</h2>
          <p className="text-muted-foreground text-sm">Recent activity</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${query.isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {query.isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500">
          Error: {query.error?.message}
        </div>
      )}

      {query.isSuccess && (
        <div>
          {query.data.length === 0 ? (
            <div className="bg-card rounded-xl p-8 border border-border text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">No Transactions</h3>
              <p className="text-muted-foreground text-sm">No history found.</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {items?.map((item) => (
                  <div key={item.signature} className="p-3 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          item.err ? 'bg-destructive/10' : 'bg-primary/10'
                        }`}>
                          {item.err ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <ExplorerLink
                            path={`tx/${item.signature}`}
                            label={<span className="font-mono text-sm hover:text-primary">{ellipsify(item.signature, 10)}</span>}
                          />
                          <p className="text-xs text-muted-foreground">
                            {item.blockTime ? new Date(item.blockTime * 1000).toLocaleDateString() : '-'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${item.err ? 'text-destructive' : 'text-primary'}`}>
                        {item.err ? 'Failed' : 'Success'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {(query.data?.length ?? 0) > 5 && (
                <div className="p-3 border-t border-border text-center">
                  <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Show Less' : `Show All (${query.data.length})`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BalanceSol({ balance }: { balance: number }) {
  return <span>{Math.round((balance / LAMPORTS_PER_SOL) * 100000) / 100000}</span>
}

function ModalReceive({ address }: { address: PublicKey }) {
  return (
    <AppModal title="Receive">
      <p>Receive assets by sending them to your public key:</p>
      <code>{address.toString()}</code>
    </AppModal>
  )
}

function ModalAirdrop({ address }: { address: PublicKey }) {
  const mutation = useRequestAirdrop({ address })
  const [amount, setAmount] = useState('2')

  return (
    <AppModal
      title="Airdrop"
      submitDisabled={!amount || mutation.isPending}
      submitLabel="Request Airdrop"
      submit={() => mutation.mutateAsync(parseFloat(amount))}
    >
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}

function ModalSend({ address }: { address: PublicKey }) {
  const wallet = useWallet()
  const mutation = useTransferSol({ address })
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('1')

  if (!address || !wallet.sendTransaction) {
    return <div>Wallet not connected</div>
  }

  return (
    <AppModal
      title="Send"
      submitDisabled={!destination || !amount || mutation.isPending}
      submitLabel="Send"
      submit={() => {
        mutation.mutateAsync({
          destination: new PublicKey(destination),
          amount: parseFloat(amount),
        })
      }}
    >
      <Label htmlFor="destination">Destination</Label>
      <Input
        disabled={mutation.isPending}
        id="destination"
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Destination"
        type="text"
        value={destination}
      />
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}
