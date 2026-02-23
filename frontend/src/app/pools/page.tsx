"use client";

import { useProtocolData, PoolData } from "@/lib/hooks/useProtocolData";
import { useProgram } from "@/lib/useProgram";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Droplets,
  TrendingUp,
  ArrowRight,
  Landmark,
  Activity,
  Percent,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// Modular imports
import { LoadingState } from "@/components/ui/loading";
import { WarningState, EmptyState } from "@/components/ui/empty-state";
import { StatBadge } from "@/components/ui/stat-card";
import { formatAmount, formatBps } from "@/lib/format";

export default function PoolsPage() {
  const { ready } = useProgram();
  const { pools, globalState, loading, initialized, refresh } = useProtocolData();

  if (!ready || loading) {
    return <LoadingState message="Loading pools..." />;
  }

  if (!initialized) {
    return (
      <WarningState
        title="Protocol Not Initialized"
        description="The protocol needs to be initialized before pools can be created."
        actionLabel="Go to Admin Panel"
        actionHref="/instructions"
      />
    );
  }

  const totalTVL = pools.reduce((sum: bigint, p: PoolData) => sum + p.totalCollateral, 0n);
  const activePools = pools.filter((p: PoolData) => p.isActive).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-emerald-500 flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Collateral Pools</h1>
            <p className="text-neutral-500 mt-1">
              Browse available collateral types and their parameters
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/20">
              <Landmark className="h-6 w-6" />
            </div>
            <span className="font-medium">Total Value Locked</span>
          </div>
          <p className="text-4xl font-bold">{formatAmount(totalTVL)}</p>
          <p className="text-emerald-100 text-sm mt-1">Across all pools</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Activity className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="font-medium">Active Pools</span>
          </div>
          <p className="text-4xl font-bold">
            {activePools}
            <span className="text-neutral-400 text-lg font-normal">/{pools.length}</span>
          </p>
          <p className="text-neutral-500 text-sm mt-1">Accepting deposits</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Percent className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="font-medium">Stability Fee</span>
          </div>
          <p className="text-4xl font-bold">
            {globalState ? formatBps(globalState.stabilityFee) : "—"}
          </p>
          <p className="text-neutral-500 text-sm mt-1">Annual rate</p>
        </div>
      </div>

      {/* Pools Grid */}
      {pools.length === 0 ? (
        <EmptyState
          icon={Droplets}
          title="No Pools Yet"
          description="No collateral pools have been initialized."
          actionLabel="Create Pool"
          actionHref="/instructions"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pools.map((pool: PoolData) => (
            <div
              key={pool.address.toString()}
              className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 hover:shadow-lg transition-all overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
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
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      pool.isActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-red-500/10 text-red-500"
                    }`}
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
          ))}
        </div>
      )}
    </div>
  );
}
