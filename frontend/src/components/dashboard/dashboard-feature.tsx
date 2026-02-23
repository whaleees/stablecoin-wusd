"use client";

import { useProtocolData, useUserVaults, PoolData } from "@/lib/hooks/useProtocolData";
import { useProgram } from "@/lib/useProgram";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { ActionCard } from "@/components/ui/action-card";
import { LoadingState } from "@/components/ui/loading";
import { VaultPositionCard } from "@/components/protocol/vault-position";
import { formatAmount, formatBps } from "@/lib/format";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  Shield,
  Coins,
  ArrowRight,
  PiggyBank,
  Landmark,
  AlertCircle,
} from "lucide-react";

export function DashboardFeature() {
  const { ready } = useProgram();
  const { globalState, pools, loading, initialized } = useProtocolData();
  const { vaults } = useUserVaults();

  if (!ready || loading) {
    return <LoadingState message="Loading protocol..." />;
  }

  // Calculate totals
  const totalCollateral = pools.reduce(
    (sum: bigint, p: PoolData) => sum + p.totalCollateral,
    0n
  );
  const totalDebt = globalState?.totalDebt ?? 0n;
  const activeVaults = vaults.filter((v) => v.debtAmount > 0n);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-800 p-8 md:p-12">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xl">
              W
            </div>
            <span className="text-2xl font-bold text-white">WUSD</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Decentralized Stablecoin Protocol
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mb-6">
            Deposit collateral, mint WUSD stablecoins, and manage your positions
            with transparent on-chain mechanics.
          </p>
          {!initialized && (
            <div className="flex items-center gap-2 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-lg w-fit">
              <AlertCircle className="h-5 w-5" />
              <span>Protocol not initialized. Go to Admin to set up.</span>
            </div>
          )}
          {initialized && (
            <div className="flex flex-wrap gap-3">
              <Link href="/vault">
                <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                  Open Vault
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pools">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-white border-white/30 hover:bg-white/10"
                >
                  View Pools
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {initialized && globalState && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Value Locked"
            value={formatAmount(totalCollateral)}
            subtext="Across all pools"
            icon={Landmark}
            accent
          />
          <StatCard
            title="Total WUSD Minted"
            value={formatAmount(totalDebt)}
            subtext={`Ceiling: ${formatAmount(globalState.debtCeiling)}`}
            icon={Coins}
          />
          <StatCard
            title="Active Pools"
            value={pools.length.toString()}
            subtext="Collateral types"
            icon={PiggyBank}
          />
          <StatCard
            title="Stability Fee"
            value={formatBps(globalState.stabilityFee)}
            subtext="Annual rate"
            icon={TrendingUp}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            title="Manage Vault"
            description="Deposit collateral, mint WUSD, or repay debt"
            href="/vault"
            icon={Wallet}
          />
          <ActionCard
            title="Browse Pools"
            description="View available collateral types and parameters"
            href="/pools"
            icon={Shield}
          />
          <ActionCard
            title="Admin Panel"
            description="Initialize and manage protocol settings"
            href="/instructions"
            icon={Landmark}
          />
        </div>
      </div>

      {/* User Positions */}
      {activeVaults.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Your Positions</h2>
            <Link href="/vault">
              <Button variant="ghost" size="sm">
                Manage All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeVaults.map((vault) => {
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

      {/* Protocol Parameters */}
      {initialized && globalState && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold mb-4">Protocol Parameters</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-neutral-500 mb-1">Debt Ceiling</p>
              <p className="font-semibold">{formatAmount(globalState.debtCeiling)} WUSD</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-1">Stability Fee</p>
              <p className="font-semibold">{formatBps(globalState.stabilityFee)}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-1">Liquidation Penalty</p>
              <p className="font-semibold text-amber-500">
                {formatBps(globalState.liquidationPenalty)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-1">Admin</p>
              <p className="font-mono text-sm truncate">
                {globalState.admin.toString().slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
