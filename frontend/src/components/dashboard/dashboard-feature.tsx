"use client";

import { useProtocolData, useUserVaults, PoolData } from "@/lib/hooks/useProtocolData";
import { Button } from "@/components/ui/button";
import { VaultPositionCard } from "@/components/protocol/vault-position";
import { formatAmount, formatBps } from "@/lib/format";
import { getCollateralByMint } from "@/lib/collateral";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Database, Gauge, Loader2, Percent, ShieldCheck, Wallet2 } from "lucide-react";

export function DashboardFeature() {
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

  const stats =
    initialized && globalState
      ? [
          {
            label: "Total Value Locked",
            value: formatAmount(totalCollateral),
            icon: Database,
            tone: "text-chart-1",
          },
          {
            label: "WUSD Minted",
            value: formatAmount(totalDebt),
            icon: Wallet2,
            tone: "text-chart-2",
          },
          {
            label: "Active Pools",
            value: `${pools.filter((p) => p.isActive).length}`,
            icon: ShieldCheck,
            tone: "text-chart-4",
          },
          {
            label: "Stability Fee",
            value: formatBps(globalState.stabilityFee),
            icon: Percent,
            tone: "text-primary",
          },
          {
            label: "Debt Ceiling",
            value: formatAmount(globalState.debtCeiling),
            icon: Gauge,
            tone: "text-chart-5",
          },
        ]
      : [];

  return (
    <div className="w-full space-y-8 md:space-y-10">
      <section className="surface-card rise-in relative overflow-hidden rounded-3xl px-6 pb-12 pt-12 md:px-10 md:pb-16 md:pt-16">
        <div className="aurora-layer pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_88%,rgba(20,210,255,0.25),transparent_35%),radial-gradient(circle_at_88%_26%,rgba(78,255,222,0.16),transparent_40%),linear-gradient(160deg,rgba(2,22,37,0.82),rgba(3,8,20,0.9))]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="fx-fade-up [--fade-delay:80ms] text-4xl font-medium leading-tight md:text-6xl">Manage Your Digital Assets With Confidence</h1>
          <p className="fx-fade-up [--fade-delay:160ms] mx-auto mt-5 max-w-2xl text-sm text-muted-foreground md:text-base">
            WUSD is a decentralized stablecoin backed by transparent on-chain collateral, designed for practical everyday DeFi.
          </p>
          {initialized && (
            <Link href="/vault" className="fx-fade-up [--fade-delay:240ms] mt-7 inline-block">
              <Button className="pulse-ring h-11 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-12px_var(--color-primary)] hover:bg-primary/90">
                Launch Web App <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        <div className="relative mx-auto mt-10 hidden max-w-[1360px] px-6 lg:block">
          <div className="grid min-h-[390px] grid-cols-[minmax(250px,1fr)_minmax(420px,1.2fr)_minmax(300px,1fr)] items-center gap-x-16">
            <article className="surface-card glow-card fx-float w-full max-w-[320px] justify-self-start self-center rounded-3xl p-6 xl:p-7 [--float-duration:7.4s] [--float-delay:120ms] [--fx-rotate:-7deg]">
              <p className="text-3xl font-semibold text-foreground xl:text-4xl">Collateral-First</p>
              <p className="mt-2 text-sm text-muted-foreground">Vault minting is gated by approved collateral pools and protocol limits.</p>
              <div className="mt-5 flex items-center gap-2">
                <span className="h-2 w-10 rounded-full bg-primary/70" />
                <span className="h-2 w-7 rounded-full bg-primary/40" />
                <span className="h-2 w-5 rounded-full bg-muted/70" />
              </div>
            </article>

            <article className="glow-card fx-float w-full max-w-[520px] justify-self-center self-center rounded-3xl border border-primary/35 bg-gradient-to-b from-primary/28 to-primary/8 p-7 shadow-[0_0_45px_-18px_var(--color-primary)] xl:p-8 [--float-duration:6.2s] [--float-delay:260ms] [--fx-rotate:0deg]">
              <h3 className="text-4xl font-semibold leading-none text-foreground xl:text-5xl">Protocol-Grade Safeguards</h3>
              <p className="mt-3 text-sm text-foreground/75">On-chain checks enforce debt ceilings, collateral factors, and liquidation boundaries.</p>
            </article>

            <div className="relative h-[360px] w-full max-w-[360px] justify-self-end self-center">
              <article className="surface-card glow-card fx-float absolute right-0 top-0 w-[230px] rounded-3xl p-5 [--float-duration:6.8s] [--float-delay:760ms] [--fx-rotate:4deg]">
                <p className="text-2xl font-semibold text-foreground">Oracle Synced</p>
                <p className="mt-1 text-sm text-muted-foreground">Price inputs are wired into vault health and liquidation calculations.</p>
                <div className="mt-4 flex items-center gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="h-1.5 flex-1 rounded-full bg-primary/70" />
                  ))}
                </div>
              </article>

              <article className="surface-card glow-card fx-float absolute right-[24px] top-[92px] w-[320px] rounded-3xl p-6 xl:p-7 [--float-duration:8.1s] [--float-delay:420ms] [--fx-rotate:7deg]">
                <p className="text-3xl font-semibold text-foreground xl:text-4xl">Pool Discovery</p>
                <p className="mt-2 text-sm text-muted-foreground">Monitor enabled collateral markets and their live protocol configuration.</p>
                <div className="mt-8 grid grid-cols-8 gap-1">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-3.5 w-3.5 rounded-full ${i % 3 === 0 ? "bg-primary/80" : "bg-muted/55"}`}
                    />
                  ))}
                </div>
              </article>

              <article className="surface-card glow-card fx-float absolute right-0 top-[236px] w-[250px] rounded-3xl p-6 [--float-duration:7.2s] [--float-delay:620ms] [--fx-rotate:5deg]">
                <p className="text-2xl font-semibold text-foreground xl:text-3xl">Risk Limits Active</p>
                <p className="mt-2 text-sm text-muted-foreground">Collateral and liquidation parameters are enforced for safe test operations.</p>
                <div className="mt-6 h-2 w-full rounded-full bg-muted/60">
                  <div className="h-full w-[82%] rounded-full bg-primary shadow-[0_0_16px_-5px_var(--color-primary)]" />
                </div>
              </article>
            </div>
          </div>

          <div className="fx-line [--line-delay:0ms] absolute left-[24%] top-[56%] h-px w-[24%] bg-gradient-to-r from-primary/15 via-primary/80 to-transparent" />
          <div className="fx-line [--line-delay:500ms] absolute left-[53%] top-[56%] h-px w-[18%] bg-gradient-to-r from-accent/30 via-chart-2/80 to-transparent" />
          <div className="fx-line [--line-delay:760ms] absolute left-[72%] top-[35%] h-px w-[11%] bg-gradient-to-r from-primary/10 via-primary/60 to-transparent" />
        </div>
      </section>

      {initialized && globalState && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article key={stat.label} className="surface-card glow-card fx-fade-up rounded-2xl p-4 [--fade-delay:120ms] md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                  <Icon className={`h-4 w-4 ${stat.tone}`} />
                </div>
                <p className="text-2xl font-bold leading-none md:text-[1.7rem]">{stat.value}</p>
              </article>
            );
          })}
        </section>
      )}

      {activeVaults.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Positions</h2>
            <Link href="/vault" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeVaults.slice(0, 6).map((vault) => {
              const pool = pools.find((p) => p.address.equals(vault.pool));
              return <VaultPositionCard key={vault.address.toString()} vault={vault} pool={pool} />;
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Available Collaterals</h2>
          <Link href="/pools" className="text-sm font-medium text-primary hover:underline">
            View details
          </Link>
        </div>

        <div className="surface-card hidden overflow-hidden rounded-2xl lg:block">
          <div className="grid grid-cols-12 gap-4 border-b border-border/80 px-5 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
                className="grid grid-cols-12 items-center gap-4 border-b border-border/70 px-5 py-3.5 transition-colors last:border-0 hover:bg-secondary/35"
              >
                <div className="col-span-4 flex items-center gap-3">
                  {config?.image ? (
                    <Image src={config.image} alt={config.symbol} width={30} height={30} className="rounded-full" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                      {config?.symbol.slice(0, 2) || "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{config?.symbol || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{config?.name || "-"}</p>
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm font-medium">{formatAmount(pool.totalCollateral)}</div>
                <div className="col-span-2 text-right text-sm font-semibold text-primary">{formatBps(pool.collateralFactor)}</div>
                <div className="col-span-2 text-right text-sm font-semibold text-destructive">{formatBps(pool.liquidationFactor)}</div>
                <div className="col-span-2 flex justify-center">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      pool.isActive ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {pool.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 lg:hidden">
          {pools.map((pool) => {
            const config = getCollateralByMint(pool.mint);
            return (
              <article key={pool.address.toString()} className="surface-card rounded-2xl p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {config?.image ? (
                      <Image src={config.image} alt={config.symbol} width={30} height={30} className="rounded-full" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        {config?.symbol.slice(0, 2) || "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold">{config?.symbol || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{config?.name || "-"}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      pool.isActive ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {pool.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">TVL</dt>
                    <dd className="font-semibold">{formatAmount(pool.totalCollateral)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">LTV</dt>
                    <dd className="font-semibold text-primary">{formatBps(pool.collateralFactor)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Liq</dt>
                    <dd className="font-semibold text-destructive">{formatBps(pool.liquidationFactor)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
