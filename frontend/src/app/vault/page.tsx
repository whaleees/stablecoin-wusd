"use client";

import { useState, useEffect } from "react";
import { useProgram } from "@/lib/useProgram";
import { useProtocolData, useUserVaults, PoolData } from "@/lib/hooks/useProtocolData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { deposit } from "@/lib/tx/deposit";
import { withdraw } from "@/lib/tx/withdraw";
import { mintStable } from "@/lib/tx/mint";
import { repay } from "@/lib/tx/repay";
import Link from "next/link";
import {
  Coins,
  RefreshCw,
  ArrowLeft,
  PlusCircle,
  MinusCircle,
  Banknote,
  Undo2,
  Shield,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// Modular imports
import { HealthIndicator } from "@/components/protocol/health-indicator";
import { LoadingState } from "@/components/ui/loading";
import { WarningState, EmptyState } from "@/components/ui/empty-state";
import { formatAmount, formatBps } from "@/lib/format";

type Tab = "deposit" | "withdraw" | "mint" | "repay";

const TAB_CONFIG = {
  deposit: {
    icon: PlusCircle,
    label: "Deposit",
    inputLabel: "Collateral Amount",
    buttonLabel: "Deposit Collateral",
    description: "Add collateral to increase your borrowing power",
  },
  withdraw: {
    icon: MinusCircle,
    label: "Withdraw",
    inputLabel: "Shares to Withdraw",
    buttonLabel: "Withdraw Collateral",
    description: "Remove collateral (maintain safe ratio)",
  },
  mint: {
    icon: Banknote,
    label: "Mint",
    inputLabel: "WUSD Amount",
    buttonLabel: "Mint WUSD",
    description: "Borrow WUSD against your collateral",
  },
  repay: {
    icon: Undo2,
    label: "Repay",
    inputLabel: "WUSD Amount",
    buttonLabel: "Repay Debt",
    description: "Reduce your debt and improve health",
  },
};

function TabButton({
  active,
  onClick,
  tab,
}: {
  active: boolean;
  onClick: () => void;
  tab: Tab;
}) {
  const config = TAB_CONFIG[tab];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-xl font-medium transition-all ${
        active
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
          : "bg-white dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-750"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm">{config.label}</span>
    </button>
  );
}

export default function VaultPage() {
  const { program, ready } = useProgram();
  const { globalState, pools, loading, initialized, refresh } = useProtocolData();
  const { vaults, refresh: refreshVaults } = useUserVaults();

  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txResult, setTxResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Find user's vault for selected pool
  const userVault = selectedPool
    ? vaults.find((v) => v.pool.equals(selectedPool.address))
    : null;

  useEffect(() => {
    if (pools.length > 0 && !selectedPool) {
      setSelectedPool(pools[0]);
    }
  }, [pools, selectedPool]);

  const handleTransaction = async () => {
    if (!program || !selectedPool || !amount || !globalState) return;

    setTxLoading(true);
    setTxResult(null);

    try {
      const user = program.provider.publicKey!;

      // Convert human-readable amount to proper decimals
      const parseAmount = parseFloat(amount);
      if (isNaN(parseAmount) || parseAmount <= 0) {
        throw new Error("Invalid amount");
      }

      // SOL has 9 decimals, WUSD has 6 decimals
      const solDecimals = 9;
      const wusdDecimals = 6;

      let sig: string;

      switch (activeTab) {
        case "deposit": {
          const collateralAmount = new BN(Math.floor(parseAmount * 10 ** solDecimals));
          sig = await deposit({
            program,
            user,
            collateralMint: selectedPool.mint,
            collateralAmount,
          });
          break;
        }

        case "withdraw": {
          // Shares use same decimals as collateral
          const sharesToBurn = new BN(Math.floor(parseAmount * 10 ** solDecimals));
          sig = await withdraw({
            program,
            user,
            collateralMint: selectedPool.mint,
            sharesToBurn,
          });
          break;
        }

        case "mint": {
          // Need price feed - use mock for now
          const priceFeedStr = process.env.NEXT_PUBLIC_PRICE_FEED;
          if (!priceFeedStr) {
            throw new Error("NEXT_PUBLIC_PRICE_FEED not set");
          }
          const stableAmount = new BN(Math.floor(parseAmount * 10 ** wusdDecimals));
          sig = await mintStable({
            program,
            user,
            collateralMint: selectedPool.mint,
            stablecoinMint: globalState.stablecoinMint,
            priceFeed: new PublicKey(priceFeedStr),
            stableAmount,
          });
          break;
        }

        case "repay": {
          const repayAmount = new BN(Math.floor(parseAmount * 10 ** wusdDecimals));
          sig = await repay({
            program,
            user,
            collateralMint: selectedPool.mint,
            stablecoinMint: globalState.stablecoinMint,
            repayAmount,
          });
          break;
        }

        default:
          throw new Error("Unknown action");
      }

      setTxResult({ success: true, message: `Transaction successful! Sig: ${sig.slice(0, 8)}...` });
      setAmount("");
      refresh();
      refreshVaults();
    } catch (e: any) {
      console.error(e);
      setTxResult({
        success: false,
        message: e?.message || "Transaction failed",
      });
    } finally {
      setTxLoading(false);
    }
  };

  if (!ready || loading) {
    return <LoadingState message="Loading vault..." />;
  }

  if (!initialized) {
    return (
      <WarningState
        title="Protocol Not Initialized"
        description="The protocol needs to be initialized before you can use vaults."
      />
    );
  }

  if (pools.length === 0) {
    return (
      <EmptyState
        icon={Coins}
        title="No Pools Available"
        description="No collateral pools have been created yet."
        actionLabel="Go to Admin Panel"
        actionHref="/instructions"
      />
    );
  }

  // Calculate health ratio
  const collateralValue = userVault ? Number(userVault.collateralShares) : 0;
  const debtValue = userVault ? Number(userVault.debtAmount) : 0;
  const healthRatio = debtValue > 0 ? (collateralValue / debtValue) * 100 : 0;

  const tabConfig = TAB_CONFIG[activeTab];
  const TabIcon = tabConfig.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-emerald-500 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">Manage Your Vault</h1>
          <p className="text-neutral-500 mt-1">
            Deposit collateral, mint WUSD, and manage your position
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refresh();
            refreshVaults();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Pool Selector */}
      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Select Collateral Pool</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {pools.map((pool) => (
            <button
              key={pool.address.toString()}
              onClick={() => setSelectedPool(pool)}
              className={`px-5 py-4 rounded-xl border-2 transition-all ${
                selectedPool?.address.equals(pool.address)
                  ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                  : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-emerald-500/50"
              }`}
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
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Vault Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Health */}
          {userVault && debtValue > 0 && <HealthIndicator ratio={healthRatio} />}

          {/* Vault Stats */}
          <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold mb-4">Your Position</h2>

            {userVault ? (
              <div className="space-y-4">
                <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-sm mb-2">
                    <TrendingUp className="h-4 w-4" />
                    Collateral Deposited
                  </div>
                  <p className="text-2xl font-bold">
                    {formatAmount(userVault.collateralShares)}
                  </p>
                </div>

                <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-sm mb-2">
                    <Coins className="h-4 w-4" />
                    Debt Outstanding
                  </div>
                  <p className="text-2xl font-bold text-amber-500">
                    {formatAmount(userVault.debtAmount)}{" "}
                    <span className="text-sm font-normal">WUSD</span>
                  </p>
                </div>

                {Number(userVault.accruedInterest) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Accrued Interest</span>
                    <span className="font-medium text-amber-500">
                      +{userVault.accruedInterest.toString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 bg-white dark:bg-neutral-800 rounded-xl">
                <Coins className="h-10 w-10 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-500 mb-1">No active position</p>
                <p className="text-sm text-neutral-400">
                  Deposit collateral to get started
                </p>
              </div>
            )}
          </div>

          {/* Pool Info */}
          {selectedPool && (
            <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
              <h3 className="font-semibold mb-4">Pool Parameters</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Collateral</span>
                  <span className="font-medium">
                    {formatAmount(selectedPool.totalCollateral)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Collateral Ratio</span>
                  <span className="font-medium">{formatBps(selectedPool.collateralFactor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Liquidation Threshold</span>
                  <span className="font-medium text-amber-500">
                    {formatBps(selectedPool.liquidationFactor)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="lg:col-span-3">
          <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
            {/* Tab Selector */}
            <div className="flex gap-2 mb-6">
              <TabButton active={activeTab === "deposit"} onClick={() => setActiveTab("deposit")} tab="deposit" />
              <TabButton active={activeTab === "withdraw"} onClick={() => setActiveTab("withdraw")} tab="withdraw" />
              <TabButton active={activeTab === "mint"} onClick={() => setActiveTab("mint")} tab="mint" />
              <TabButton active={activeTab === "repay"} onClick={() => setActiveTab("repay")} tab="repay" />
            </div>

            {/* Action Form */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TabIcon className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold">{tabConfig.label}</h3>
                  <p className="text-xs text-neutral-500">{tabConfig.description}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-500 mb-2">
                    {tabConfig.inputLabel}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="text-2xl h-14 pr-20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                      {activeTab === "mint" || activeTab === "repay" ? "WUSD" : "Tokens"}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-base bg-emerald-500 hover:bg-emerald-600"
                  onClick={handleTransaction}
                  disabled={!amount || txLoading}
                >
                  {txLoading ? (
                    <span className="flex items-center">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Processing...
                    </span>
                  ) : (
                    <>
                      <TabIcon className="h-5 w-5 mr-2" />
                      {tabConfig.buttonLabel}
                    </>
                  )}
                </Button>

                {txResult && (
                  <div
                    className={`p-4 rounded-xl text-sm flex items-start gap-3 ${
                      txResult.success
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 border border-red-500/20"
                    }`}
                  >
                    {txResult.success ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{txResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
