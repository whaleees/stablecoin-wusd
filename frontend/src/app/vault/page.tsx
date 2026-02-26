"use client";

import { useState, useMemo, useCallback } from "react";
import { useProgram } from "@/lib/useProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProtocolData, useUserVaults, PoolData, UserVaultData } from "@/lib/hooks/useProtocolData";
import { useGetBalance, useGetTokenAccounts } from "@/components/account/account-data-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Search,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { formatLamports, formatBps } from "@/lib/format";
import { getCollateralByMint, COLLATERAL_CONFIGS } from "@/lib/collateral";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

type Filter = "all" | "active" | "positions";

export default function VaultPage() {
  const { program, ready, connected } = useProgram();
  const { globalState, pools: allPools, loading, initialized, refresh } = useProtocolData();
  const { vaults, refresh: refreshVaults } = useUserVaults();

  const pools = useMemo(
    () => allPools.filter((p) => getCollateralByMint(p.mint) !== undefined),
    [allPools]
  );

  const { publicKey } = useWallet();
  
  // Fetch user balances
  const solBalance = useGetBalance({ address: publicKey! });
  const tokenAccounts = useGetTokenAccounts({ address: publicKey! });
  
  // Map token balances by mint
  const tokenBalances = useMemo(() => {
    const balances: Record<string, { amount: number; symbol: string; decimals: number }> = {};
    
    // Add SOL balance
    if (solBalance.data !== undefined) {
      balances["So11111111111111111111111111111111111111112"] = {
        amount: solBalance.data / LAMPORTS_PER_SOL,
        symbol: "SOL",
        decimals: 9,
      };
    }
    
    // Add SPL token balances
    if (tokenAccounts.data) {
      for (const acc of tokenAccounts.data) {
        const info = acc.account.data.parsed.info;
        const mint = info.mint;
        const config = COLLATERAL_CONFIGS.find(c => c.mint.toBase58() === mint);
        if (config) {
          balances[mint] = {
            amount: Number(info.tokenAmount.uiAmount) || 0,
            symbol: config.symbol,
            decimals: config.decimals,
          };
        }
      }
    }
    
    return balances;
  }, [solBalance.data, tokenAccounts.data]);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetResult, setFaucetResult] = useState<{ success: boolean; message: string } | null>(null);

  const requestFaucet = useCallback(async () => {
    if (!publicKey) return;
    setFaucetLoading(true);
    setFaucetResult(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (res.ok) {
        setFaucetResult({ success: data.success, message: data.message });
        refresh();
        refreshVaults();
        solBalance.refetch();
        tokenAccounts.refetch();
      } else {
        setFaucetResult({ success: false, message: data.error || "Failed to request tokens" });
      }
    } catch (err) {
      setFaucetResult({ success: false, message: "Network error" });
    } finally {
      setFaucetLoading(false);
    }
  }, [publicKey, refresh, refreshVaults, solBalance, tokenAccounts]);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);

  const getUserVault = (pool: PoolData): UserVaultData | undefined =>
    vaults.find((v) => v.pool.equals(pool.address));

  const filteredPools = useMemo(() => {
    let result = pools;

    if (filter === "active") {
      result = result.filter((p) => p.isActive);
    } else if (filter === "positions") {
      result = result.filter((p) => {
        const v = getUserVault(p);
        return v && (v.collateralShares > 0n || v.debtAmount > 0n);
      });
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p) => {
        const config = getCollateralByMint(p.mint);
        return (
          config?.symbol.toLowerCase().includes(s) ||
          config?.name.toLowerCase().includes(s)
        );
      });
    }

    return result;
  }, [pools, filter, search, vaults]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Protocol not initialized</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All Pools
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "active"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("positions")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === "positions"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            My Positions
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64 bg-secondary border-0"
          />
        </div>
      </div>

      {/* Info */}
      <p className="text-muted-foreground text-sm mb-4">
        Showing {filteredPools.length} of {pools.length} pools
      </p>

      {/* Wallet Balances & Devnet Faucet */}
      <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Your Wallet</h4>
              <p className="text-xs text-muted-foreground">
                Current holdings &amp; devnet faucet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {faucetResult && (
              <span className={`text-xs ${faucetResult.success ? "text-green-400" : "text-red-400"}`}>
                {faucetResult.message}
              </span>
            )}
            <Button
              onClick={requestFaucet}
              disabled={!publicKey || faucetLoading}
              size="sm"
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              {faucetLoading ? (
                <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Minting...</>
              ) : (
                "Get Test Tokens"
              )}
            </Button>
          </div>
        </div>
        
        {/* Balances Grid */}
        {publicKey ? (
          <div className="grid grid-cols-4 gap-3">
            {COLLATERAL_CONFIGS.map((config) => {
              const balance = tokenBalances[config.mint.toBase58()];
              return (
                <div
                  key={config.symbol}
                  className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg"
                >
                  <Image
                    src={config.image}
                    alt={config.symbol}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{config.symbol}</p>
                    <p className="text-sm font-medium truncate">
                      {balance ? balance.amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Connect wallet to view balances</p>
        )}
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
        <div className="col-span-3">Pool</div>
        <div className="col-span-2 text-right">LTV</div>
        <div className="col-span-2 text-right">TVL</div>
        <div className="col-span-2 text-right">Your Position</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-1"></div>
      </div>

      {/* Pools List */}
      <div className="divide-y divide-border">
        {filteredPools.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No pools found
          </div>
        ) : (
          filteredPools.map((pool) => {
            const config = getCollateralByMint(pool.mint);
            const vault = getUserVault(pool);
            const hasPosition = vault && (vault.collateralShares > 0n || vault.debtAmount > 0n);

            return (
              <Link
                key={pool.address.toString()}
                href={`/pools/${config?.symbol || ''}`}
                className="grid grid-cols-12 gap-4 px-4 py-4 items-center cursor-pointer transition-colors hover:bg-secondary/50"
              >
                {/* Pool Info */}
                <div className="col-span-3 flex items-center gap-3">
                  {config?.image ? (
                    <Image
                      src={config.image}
                      alt={config.symbol}
                      width={36}
                      height={36}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      {config?.symbol.slice(0, 2) || "?"}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{config?.symbol || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{config?.name || "—"}</p>
                  </div>
                </div>

                {/* LTV */}
                <div className="col-span-2 text-right">
                  <span className="text-primary font-medium">{formatBps(pool.collateralFactor)}</span>
                </div>

                {/* TVL */}
                <div className="col-span-2 text-right font-medium">
                  {formatLamports(pool.totalCollateral, config?.decimals || 9)}
                </div>

                {/* Position */}
                <div className="col-span-2 text-right">
                  {hasPosition ? (
                    <div>
                      <p className="font-medium">
                        {formatLamports(vault!.collateralShares, config?.decimals || 9)}
                      </p>
                      {vault!.debtAmount > 0n && (
                        <p className="text-xs text-muted-foreground">
                          {formatLamports(vault!.debtAmount, 6)} WUSD
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-2 flex justify-center">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      pool.isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {pool.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Arrow */}
                <div className="col-span-1 flex justify-end">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
