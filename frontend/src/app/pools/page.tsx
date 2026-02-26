"use client";

import { useProtocolData, PoolData } from "@/lib/hooks/useProtocolData";
import { useProgram } from "@/lib/useProgram";
import { usePrices } from "@/lib/hooks/usePrices";
import { getCollateralByMint } from "@/lib/collateral";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatAmount, formatBps } from "@/lib/format";

export default function PoolsPage() {
  const { ready } = useProgram();
  const { pools, globalState, loading, initialized } = useProtocolData();
  const { prices, loading: pricesLoading } = usePrices({ interval: 1000 });

  const knownPools = pools.filter((p: PoolData) => getCollateralByMint(p.mint) !== undefined);
  const totalTVL = knownPools.reduce((sum: bigint, p: PoolData) => sum + p.totalCollateral, 0n);
  const activePools = knownPools.filter((p: PoolData) => p.isActive).length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!initialized || knownPools.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No pools available</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Collateral Pools</h1>
          <p className="text-muted-foreground text-sm">
            {activePools} active pools • {formatAmount(totalTVL)} TVL
          </p>
        </div>
        <Link href="/vault">
          <Button className="bg-primary hover:bg-primary/90">
            Open Vault <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-muted-foreground text-xs mb-1">Total TVL</p>
          <p className="text-xl font-bold">{formatAmount(totalTVL)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-muted-foreground text-xs mb-1">Active Pools</p>
          <p className="text-xl font-bold">{activePools}<span className="text-muted-foreground">/{knownPools.length}</span></p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-muted-foreground text-xs mb-1">Stability Fee</p>
          <p className="text-xl font-bold text-primary">{globalState ? formatBps(globalState.stabilityFee) : "—"}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-muted-foreground text-xs mb-1">Liquidation Penalty</p>
          <p className="text-xl font-bold text-destructive">{globalState ? formatBps(globalState.liquidationPenalty) : "—"}</p>
        </div>
      </div>

      {/* Pools Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
          <div className="col-span-3">Collateral</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">TVL</div>
          <div className="col-span-2 text-right">LTV</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-1"></div>
        </div>
        {knownPools.map((pool: PoolData) => {
          const collateral = getCollateralByMint(pool.mint)!;
          const priceData = prices[collateral.symbol];
          return (
            <Link
              key={pool.address.toString()}
              href={`/pools/${collateral.symbol}`}
              className="grid grid-cols-12 gap-4 px-4 py-4 items-center border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
            >
              <div className="col-span-3 flex items-center gap-3">
                {collateral.image ? (
                  <Image src={collateral.image} alt={collateral.symbol} width={32} height={32} className="rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                    {collateral.symbol.slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className="font-medium">{collateral.symbol}</p>
                  <p className="text-xs text-muted-foreground">{collateral.name}</p>
                </div>
              </div>
              <div className="col-span-2 text-right">
                <span className="font-medium">
                  ${priceData?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "—"}
                </span>
              </div>
              <div className="col-span-2 text-right font-medium">
                {formatAmount(pool.totalCollateral)}
              </div>
              <div className="col-span-2 text-right text-primary font-medium">
                {formatBps(pool.collateralFactor)}
              </div>
              <div className="col-span-2 flex justify-center">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    pool.isActive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {pool.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
