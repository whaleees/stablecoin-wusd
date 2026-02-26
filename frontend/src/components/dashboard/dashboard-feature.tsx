"use client";

import { useProtocolData, useUserVaults, PoolData } from "@/lib/hooks/useProtocolData";
import { useProgram } from "@/lib/useProgram";
import { Button } from "@/components/ui/button";
import { VaultPositionCard } from "@/components/protocol/vault-position";
import { formatAmount, formatBps } from "@/lib/format";
import { getCollateralByMint } from "@/lib/collateral";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Loader2 } from "lucide-react";

export function DashboardFeature() {
  const { ready } = useProgram();
  const { globalState, pools: allPools, loading, initialized } = useProtocolData();
  const { vaults } = useUserVaults();

  const pools = allPools.filter((p) => getCollateralByMint(p.mint) !== undefined);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const totalCollateral = pools.reduce(
    (sum: bigint, p: PoolData) => sum + p.totalCollateral,
    0n
  );
  const totalDebt = globalState?.totalDebt ?? 0n;
  const activeVaults = vaults.filter((v) => v.debtAmount > 0n || v.collateralShares > 0n);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Mint WUSD stablecoins using multi-collateral vaults
          </p>
        </div>
        {initialized && (
          <Link href="/vault">
            <Button className="bg-primary hover:bg-primary/90">
              Open Vault <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Row */}
      {initialized && globalState && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Total Value Locked</p>
            <p className="text-xl font-bold">{formatAmount(totalCollateral)}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">WUSD Minted</p>
            <p className="text-xl font-bold">{formatAmount(totalDebt)}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Active Pools</p>
            <p className="text-xl font-bold">{pools.filter((p) => p.isActive).length}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Stability Fee</p>
            <p className="text-xl font-bold text-primary">{formatBps(globalState.stabilityFee)}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Debt Ceiling</p>
            <p className="text-xl font-bold">{formatAmount(globalState.debtCeiling)}</p>
          </div>
        </div>
      )}

      {/* Your Positions */}
      {activeVaults.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Your Positions</h2>
            <Link href="/vault" className="text-primary text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeVaults.slice(0, 6).map((vault) => {
              const pool = pools.find((p) => p.address.equals(vault.pool));
              return (
                <VaultPositionCard
                  key={vault.address.toString()}
                  vault={vault}
                  pool={pool}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Available Pools */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Available Collaterals</h2>
          <Link href="/pools" className="text-primary text-sm hover:underline">
            View Details
          </Link>
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <div className="col-span-4">Asset</div>
            <div className="col-span-2 text-right">TVL</div>
            <div className="col-span-2 text-right">LTV</div>
            <div className="col-span-2 text-right">Liq. Factor</div>
            <div className="col-span-2 text-center">Status</div>
          </div>
          {pools.map((pool) => {
            const config = getCollateralByMint(pool.mint);
            return (
              <div
                key={pool.address.toString()}
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
              >
                <div className="col-span-4 flex items-center gap-3">
                  {config?.image ? (
                    <Image src={config.image} alt={config.symbol} width={28} height={28} className="rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {config?.symbol.slice(0, 2) || "?"}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{config?.symbol || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{config?.name || "—"}</p>
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm">
                  {formatAmount(pool.totalCollateral)}
                </div>
                <div className="col-span-2 text-right text-sm text-primary font-medium">
                  {formatBps(pool.collateralFactor)}
                </div>
                <div className="col-span-2 text-right text-sm text-destructive">
                  {formatBps(pool.liquidationFactor)}
                </div>
                <div className="col-span-2 flex justify-center">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      pool.isActive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {pool.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
