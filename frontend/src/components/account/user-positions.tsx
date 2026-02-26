'use client'

import { useUserVaults, useProtocolData, UserVaultData, PoolData } from '@/lib/hooks/useProtocolData'
import { getCollateralByMint, COLLATERAL_CONFIGS, CollateralConfig } from '@/lib/collateral'
import { RefreshCw, Vault, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'

function formatTokenAmount(amount: bigint, decimals: number): string {
  const value = Number(amount) / 10 ** decimals
  if (value === 0) return '0'
  if (value < 0.01) return value.toFixed(6)
  if (value < 100) return value.toFixed(4)
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function calculateHealthRatio(
  collateralShares: bigint,
  debtAmount: bigint,
  pool: PoolData | undefined,
  collateralConfig: CollateralConfig | undefined
): { ratio: number; status: 'healthy' | 'warning' | 'danger' } {
  if (!pool || !collateralConfig || debtAmount === BigInt(0)) {
    return { ratio: 100, status: 'healthy' }
  }

  // Simplified health calculation:
  // collateral_value = collateral_shares * collateral_factor / 10000
  // health = collateral_value / debt
  const collateralFactor = Number(pool.collateralFactor)
  const liquidationFactor = Number(pool.liquidationFactor)
  
  // Estimate collateral value (shares ~= collateral in many cases)
  const sharesValue = Number(collateralShares) / 10 ** collateralConfig.decimals
  const debtValue = Number(debtAmount) / 10 ** 6 // WUSD has 6 decimals
  
  if (debtValue === 0) return { ratio: 100, status: 'healthy' }
  
  // Very rough health ratio (would need price feed for accurate calc)
  const ratio = (sharesValue * (collateralFactor / 10000)) / debtValue * 100
  
  if (ratio >= 150) return { ratio: Math.min(ratio, 999), status: 'healthy' }
  if (ratio >= 110) return { ratio, status: 'warning' }
  return { ratio, status: 'danger' }
}

function PositionCard({
  vault,
  pool,
  collateral,
}: {
  vault: UserVaultData
  pool: PoolData | undefined
  collateral: CollateralConfig | undefined
}) {
  const health = useMemo(() => 
    calculateHealthRatio(vault.collateralShares, vault.debtAmount, pool, collateral),
    [vault, pool, collateral]
  )

  const decimals = collateral?.decimals || 9
  const symbol = collateral?.symbol || 'Unknown'
  const image = collateral?.image
  
  const collateralAmount = formatTokenAmount(vault.collateralShares, decimals)
  const debtAmount = formatTokenAmount(vault.debtAmount, 6)
  const hasDebt = vault.debtAmount > BigInt(0)

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {image ? (
              <Image src={image} alt={symbol} width={40} height={40} className="rounded-full" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                {symbol.slice(0, 2)}
              </div>
            )}
            <div>
              <h3 className="font-bold">{symbol} Vault</h3>
              <p className="text-sm text-muted-foreground">{collateral?.name || 'Collateral'}</p>
            </div>
          </div>
          
          {hasDebt && (
            <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
              health.status === 'healthy' 
                ? 'bg-primary/10 text-primary' 
                : health.status === 'warning'
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {health.status === 'danger' && <AlertTriangle className="h-3 w-3" />}
              {health.ratio.toFixed(0)}%
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Collateral</p>
            <p className="text-lg font-bold">
              {collateralAmount} <span className="text-sm text-muted-foreground">{symbol}</span>
            </p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Debt</p>
            <p className="text-lg font-bold">
              {debtAmount} <span className="text-sm text-muted-foreground">WUSD</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        {pool && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              LTV {Number(pool.collateralFactor) / 100}%
            </span>
            <Link href="/vault" className="text-primary hover:underline flex items-center gap-1">
              Manage <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export function UserPositions() {
  const { vaults, loading, refresh } = useUserVaults()
  const { pools } = useProtocolData()

  const getPool = (poolAddress: string) => 
    pools.find(p => p.address.toBase58() === poolAddress)

  const getCollateral = (pool: PoolData | undefined) => 
    pool ? getCollateralByMint(pool.mint) : undefined

  // Filter vaults that have any collateral or debt
  const activeVaults = vaults.filter(v => 
    v.collateralShares > BigInt(0) || v.debtAmount > BigInt(0)
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Your Positions</h2>
          <p className="text-muted-foreground text-sm">Active vaults</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl p-8 border border-border text-center">
          <RefreshCw className="h-6 w-6 text-muted-foreground mx-auto mb-2 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      ) : activeVaults.length === 0 ? (
        <div className="bg-card rounded-xl p-8 border border-border text-center">
          <Vault className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-1">No Positions</h3>
          <p className="text-muted-foreground text-sm mb-4">
            No collateral deposited yet.
          </p>
          <Link href="/vault">
            <Button size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Open Vault
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeVaults.map((vault) => {
            const pool = getPool(vault.pool.toBase58())
            const collateral = getCollateral(pool)
            return (
              <PositionCard 
                key={vault.address.toBase58()} 
                vault={vault} 
                pool={pool}
                collateral={collateral}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
