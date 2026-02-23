"use client";

import { UserVaultData, PoolData } from "@/lib/hooks/useProtocolData";
import { formatAmount } from "@/lib/format";
import { HealthBadge } from "./health-indicator";
import { Coins, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface VaultPositionCardProps {
  vault: UserVaultData;
  pool?: PoolData;
  className?: string;
}

export function VaultPositionCard({ vault, pool, className }: VaultPositionCardProps) {
  const collateralValue = Number(vault.collateralShares);
  const debtValue = Number(vault.debtAmount);
  const ratio = debtValue > 0 ? (collateralValue / debtValue) * 100 : 0;

  return (
    <div
      className={cn(
        "bg-white dark:bg-neutral-900 rounded-xl p-5 border border-neutral-200 dark:border-neutral-800",
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <p className="font-mono text-sm text-neutral-500">
          {pool?.mint.toString().slice(0, 6) ?? "Unknown"}...
          {pool?.mint.toString().slice(-4) ?? ""}
        </p>
        {debtValue > 0 && <HealthBadge ratio={ratio} />}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-neutral-500 mb-1">Collateral</p>
          <p className="font-semibold">{formatAmount(vault.collateralShares)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1">Debt</p>
          <p className="font-semibold text-amber-500">
            {formatAmount(vault.debtAmount)} WUSD
          </p>
        </div>
      </div>
    </div>
  );
}

interface VaultStatsProps {
  vault: UserVaultData | null;
  pool: PoolData | null;
  className?: string;
}

export function VaultStats({ vault, pool, className }: VaultStatsProps) {
  if (!vault) {
    return (
      <div className={cn("text-center py-8 bg-white dark:bg-neutral-800 rounded-xl", className)}>
        <Coins className="h-10 w-10 text-neutral-400 mx-auto mb-3" />
        <p className="text-neutral-500 mb-1">No active position</p>
        <p className="text-sm text-neutral-400">Deposit collateral to get started</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-neutral-500 text-sm mb-2">
          <TrendingUp className="h-4 w-4" />
          Collateral Deposited
        </div>
        <p className="text-2xl font-bold">{formatAmount(vault.collateralShares)}</p>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-neutral-500 text-sm mb-2">
          <Coins className="h-4 w-4" />
          Debt Outstanding
        </div>
        <p className="text-2xl font-bold text-amber-500">
          {formatAmount(vault.debtAmount)}{" "}
          <span className="text-sm font-normal">WUSD</span>
        </p>
      </div>

      {Number(vault.accruedInterest) > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Accrued Interest</span>
          <span className="font-medium text-amber-500">
            +{vault.accruedInterest.toString()}
          </span>
        </div>
      )}
    </div>
  );
}
