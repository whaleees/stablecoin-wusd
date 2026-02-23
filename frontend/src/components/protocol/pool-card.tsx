"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatBadge } from "@/components/ui/stat-card";
import { PoolData } from "@/lib/hooks/useProtocolData";
import { formatAmount, formatBps } from "@/lib/format";
import {
  TrendingUp,
  Droplets,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PoolCardProps {
  pool: PoolData;
  className?: string;
}

export function PoolCard({ pool, className }: PoolCardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 hover:shadow-lg transition-all overflow-hidden",
        className
      )}
    >
      {/* Card Header */}
      <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
              {pool.mint.toString().slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {pool.mint.toString().slice(0, 6)}...
              </h3>
              <p className="font-mono text-xs text-neutral-500">
                {pool.mint.toString().slice(0, 4)}...{pool.mint.toString().slice(-4)}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
              pool.isActive
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-500"
            )}
          >
            {pool.isActive ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {pool.isActive ? "Active" : "Inactive"}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-neutral-500 text-sm mb-2">
              <TrendingUp className="h-4 w-4" />
              Total Collateral
            </div>
            <p className="text-2xl font-bold">{formatAmount(pool.totalCollateral)}</p>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-neutral-500 text-sm mb-2">
              <Droplets className="h-4 w-4" />
              Total Shares
            </div>
            <p className="text-2xl font-bold">{formatAmount(pool.totalShares)}</p>
          </div>
        </div>

        {/* Parameters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <StatBadge
            label="Collateral Ratio"
            value={formatBps(pool.collateralFactor)}
            variant="success"
          />
          <StatBadge
            label="Liquidation"
            value={formatBps(pool.liquidationFactor)}
            variant="warning"
          />
        </div>

        {/* Action */}
        <Link href="/vault">
          <Button className="w-full bg-emerald-500 hover:bg-emerald-600">
            Open Vault
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface PoolSelectorProps {
  pools: PoolData[];
  selectedPool: PoolData | null;
  onSelect: (pool: PoolData) => void;
  className?: string;
}

export function PoolSelector({
  pools,
  selectedPool,
  onSelect,
  className,
}: PoolSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {pools.map((pool) => (
        <button
          key={pool.address.toString()}
          onClick={() => onSelect(pool)}
          className={cn(
            "px-5 py-4 rounded-xl border-2 transition-all",
            selectedPool?.address.equals(pool.address)
              ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
              : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-emerald-500/50"
          )}
        >
          <p className="font-mono text-sm font-medium">
            {pool.mint.toString().slice(0, 4)}...{pool.mint.toString().slice(-4)}
          </p>
          <div className="flex gap-3 mt-2 text-xs text-neutral-500">
            <span>CR: {formatBps(pool.collateralFactor)}</span>
            <span>LT: {formatBps(pool.liquidationFactor)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
