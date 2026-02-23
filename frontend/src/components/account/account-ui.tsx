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
          <h2 className="text-2xl font-bold">Token Holdings</h2>
          <p className="text-neutral-500 text-sm">Your SPL tokens and their balances</p>
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
            <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-12 border border-neutral-200 dark:border-neutral-800 text-center">
              <Coins className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No Tokens Found</h3>
              <p className="text-neutral-500">You don't have any SPL tokens in this wallet yet.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items?.map(({ account, pubkey }) => {
                  const mintAddress = account.data.parsed.info.mint
                  const balance = account.data.parsed.info.tokenAmount.uiAmount ?? 0
                  const decimals = account.data.parsed.info.tokenAmount.decimals
                  const isWUSD = mintAddress.toLowerCase().includes('wusd')

                  return (
                    <div
                      key={pubkey.toString()}
                      className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                          {mintAddress.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-emerald-500"
                            onClick={() => copyMint(mintAddress)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <ExplorerLink
                            path={`account/${mintAddress}`}
                            label={
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-emerald-500">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-xs text-neutral-500 mb-1">Mint Address</p>
                        <p className="font-mono text-sm truncate">{ellipsify(mintAddress, 8)}</p>
                      </div>

                      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3">
                        <p className="text-xs text-neutral-500 mb-1">Balance</p>
                        <p className="text-2xl font-bold">
                          {balance.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                        </p>
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
          <h2 className="text-2xl font-bold">Transaction History</h2>
          <p className="text-neutral-500 text-sm">Recent transactions for this wallet</p>
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
            <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-12 border border-neutral-200 dark:border-neutral-800 text-center">
              <Clock className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No Transactions</h3>
              <p className="text-neutral-500">No transaction history found for this wallet.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {items?.map((item) => (
                  <div key={item.signature} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          item.err ? 'bg-red-500/10' : 'bg-emerald-500/10'
                        }`}>
                          {item.err ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          )}
                        </div>
                        <div>
                          <ExplorerLink
                            path={`tx/${item.signature}`}
                            label={
                              <span className="font-mono text-sm hover:text-emerald-500 transition-colors">
                                {ellipsify(item.signature, 12)}
                              </span>
                            }
                          />
                          <p className="text-xs text-neutral-500 mt-0.5">
                            <ExplorerLink path={`block/${item.slot}`} label={`Slot ${item.slot}`} />
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-medium ${item.err ? 'text-red-500' : 'text-emerald-500'}`}>
                          {item.err ? 'Failed' : 'Success'}
                        </span>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {item.blockTime ? new Date(item.blockTime * 1000).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {(query.data?.length ?? 0) > 5 && (
                <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 text-center">
                  <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Show Less' : `Show All (${query.data.length} transactions)`}
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
