"use client";

import { UserVaultData, PoolData } from "@/lib/hooks/useProtocolData";
import { getCollateralByMint } from "@/lib/collateral";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

interface VaultPositionCardProps {
  vault: UserVaultData;
  pool?: PoolData;
  className?: string;
}

export function VaultPositionCard({ vault, pool, className }: VaultPositionCardProps) {
  const collateral = pool ? getCollateralByMint(pool.mint) : undefined;
  const symbol = collateral?.symbol || "Unknown";
  const image = collateral?.image;
  
  const collateralValue = Number(vault.collateralShares);
  const debtValue = Number(vault.debtAmount);
  const hasDebt = debtValue > 0;

  return (
    <Link
      href="/vault"
      className={cn(
        "bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition-colors block",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        {image ? (
          <Image src={image} alt={symbol} width={28} height={28} className="rounded-full" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
            {symbol.slice(0, 2)}
          </div>
        )}
        <span className="font-medium">{symbol}</span>
        {hasDebt && (
          <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
            Active
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs mb-1">Collateral</p>
          <p className="font-medium">{formatAmount(vault.collateralShares)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Debt</p>
          <p className="font-medium">{formatAmount(vault.debtAmount)} <span className="text-muted-foreground">WUSD</span></p>
        </div>
      </div>
    </Link>
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
      <div className={cn("text-center py-6 bg-card rounded-lg border border-border", className)}>
        <p className="text-muted-foreground text-sm">No active position</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3 text-sm", className)}>
      <div className="bg-secondary rounded-lg p-3">
        <p className="text-muted-foreground text-xs mb-1">Collateral</p>
        <p className="font-bold">{formatAmount(vault.collateralShares)}</p>
      </div>
      <div className="bg-secondary rounded-lg p-3">
        <p className="text-muted-foreground text-xs mb-1">Debt</p>
        <p className="font-bold">{formatAmount(vault.debtAmount)} <span className="text-muted-foreground font-normal">WUSD</span></p>
      </div>
    </div>
  );
}
