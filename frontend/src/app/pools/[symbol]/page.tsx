"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProgram } from "@/lib/useProgram";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useProtocolData, useUserVaults, PoolData } from "@/lib/hooks/useProtocolData";
import { usePrice } from "@/lib/hooks/usePrices";
import { useGetBalance, useGetTokenAccounts } from "@/components/account/account-data-access";
import { getCollateralBySymbol, COLLATERAL_CONFIGS } from "@/lib/collateral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BN } from "@coral-xyz/anchor";
import { deposit } from "@/lib/tx/deposit";
import { withdraw } from "@/lib/tx/withdraw";
import { mintStable } from "@/lib/tx/mint";
import { repay } from "@/lib/tx/repay";
import { formatLamports, formatBps, formatAmount } from "@/lib/format";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wallet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

type Tab = "overview" | "position";
type ActionTab = "deposit" | "withdraw" | "mint" | "repay";

export default function PoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = params.symbol as string;
  
  const { program, ready, connected } = useProgram();
  const { publicKey } = useWallet();
  const { globalState, pools, loading, refresh } = useProtocolData();
  const { vaults, refresh: refreshVaults } = useUserVaults();
  
  // Get collateral config
  const collateral = useMemo(() => getCollateralBySymbol(symbol), [symbol]);
  
  // Get pool data
  const pool = useMemo(() => {
    if (!collateral) return null;
    return pools.find(p => p.mint.equals(collateral.mint));
  }, [pools, collateral]);
  
  // Real-time price (500ms refresh)
  const { price: priceData, loading: priceLoading } = usePrice(symbol, 500);
  
  // User balances
  const solBalance = useGetBalance({ address: publicKey! });
  const tokenAccounts = useGetTokenAccounts({ address: publicKey! });
  
  const walletBalance = useMemo(() => {
    if (!collateral || !publicKey) return 0;
    
    if (collateral.symbol === "SOL" && solBalance.data !== undefined) {
      return solBalance.data / LAMPORTS_PER_SOL;
    }
    
    if (tokenAccounts.data) {
      const acc = tokenAccounts.data.find(
        a => a.account.data.parsed.info.mint === collateral.mint.toBase58()
      );
      if (acc) {
        return Number(acc.account.data.parsed.info.tokenAmount.uiAmount) || 0;
      }
    }
    
    return 0;
  }, [collateral, publicKey, solBalance.data, tokenAccounts.data]);
  
  // User vault for this pool
  const userVault = useMemo(() => {
    if (!pool) return null;
    return vaults.find(v => v.pool.equals(pool.address));
  }, [pool, vaults]);
  
  // State
  const [tab, setTab] = useState<Tab>("overview");
  const [actionTab, setActionTab] = useState<ActionTab>("deposit");
  const [amount, setAmount] = useState("");
  const [txLoading, setTxLoading] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Calculate values
  const tvlUsd = useMemo(() => {
    if (!pool || !priceData) return 0;
    const tvl = Number(pool.totalCollateral) / Math.pow(10, collateral?.decimals || 9);
    return tvl * priceData.price;
  }, [pool, priceData, collateral]);
  
  const userCollateralValue = useMemo(() => {
    if (!userVault || !priceData || !collateral || !pool) return 0;
    if (pool.totalShares === 0n) return 0;
    const shares = Number(userVault.collateralShares);
    const totalShares = Number(pool.totalShares);
    const totalCollateral = Number(pool.totalCollateral) / Math.pow(10, collateral.decimals);
    const userCollateral = (shares / totalShares) * totalCollateral;
    return userCollateral * priceData.price;
  }, [userVault, priceData, collateral, pool]);
  
  const userDebtValue = useMemo(() => {
    if (!userVault) return 0;
    return Number(userVault.debtAmount) / 1e6; // WUSD has 6 decimals
  }, [userVault]);
  
  const healthFactor = useMemo(() => {
    if (!userVault || userDebtValue === 0 || !collateral) return Infinity;
    const maxBorrow = userCollateralValue * (Number(collateral.collateralFactor) / 10000);
    return maxBorrow / userDebtValue;
  }, [userCollateralValue, userDebtValue, collateral]);
  
  const handleTransaction = async () => {
    if (!program || !amount || !globalState || !pool || !collateral) return;
    
    setTxLoading(true);
    setTxResult(null);
    
    try {
      const user = program.provider.publicKey!;
      const parseAmount = parseFloat(amount);
      if (isNaN(parseAmount) || parseAmount <= 0) throw new Error("Invalid amount");
      
      let sig: string;
      
      switch (actionTab) {
        case "deposit":
          sig = await deposit({
            program,
            user,
            collateralMint: pool.mint,
            collateralAmount: new BN(Math.floor(parseAmount * 10 ** collateral.decimals)),
          });
          break;
        case "withdraw":
          sig = await withdraw({
            program,
            user,
            collateralMint: pool.mint,
            sharesToBurn: new BN(Math.floor(parseAmount * 10 ** collateral.decimals)),
          });
          break;
        case "mint":
          sig = await mintStable({
            program,
            user,
            collateralMint: pool.mint,
            stablecoinMint: globalState.stablecoinMint,
            priceFeed: collateral.priceFeed,
            stableAmount: new BN(Math.floor(parseAmount * 1e6)),
          });
          break;
        case "repay":
          sig = await repay({
            program,
            user,
            collateralMint: pool.mint,
            stablecoinMint: globalState.stablecoinMint,
            repayAmount: new BN(Math.floor(parseAmount * 1e6)),
          });
          break;
      }
      
      setTxResult({ success: true, message: "Transaction successful!" });
      setAmount("");
      refresh();
      refreshVaults();
      solBalance.refetch();
      tokenAccounts.refetch();
    } catch (err) {
      console.error("Transaction error:", err);
      setTxResult({
        success: false,
        message: err instanceof Error ? err.message : "Transaction failed",
      });
    } finally {
      setTxLoading(false);
    }
  };
  
  const handleSetAmount = (fraction: number) => {
    if (actionTab === "deposit") {
      setAmount((walletBalance * fraction).toFixed(6));
    } else if (actionTab === "withdraw" && userVault && pool && collateral) {
      if (pool.totalShares === 0n) return;
      const shares = Number(userVault.collateralShares);
      const totalShares = Number(pool.totalShares);
      const totalCollateral = Number(pool.totalCollateral) / Math.pow(10, collateral.decimals);
      const userCollateral = (shares / totalShares) * totalCollateral;
      setAmount((userCollateral * fraction).toFixed(6));
    } else if (actionTab === "repay" && userVault) {
      const debt = Number(userVault.debtAmount) / 1e6;
      setAmount((debt * fraction).toFixed(6));
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!collateral || !pool) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Pool not found</p>
        <Link href="/pools">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Pools
          </Button>
        </Link>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/pools">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Image
              src={collateral.image}
              alt={collateral.symbol}
              width={40}
              height={40}
              className="rounded-full"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{collateral.symbol} Pool</h1>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  pool.isActive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                }`}>
                  {pool.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{collateral.name}</p>
            </div>
          </div>
        </div>
        
        {/* Live Price */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Price
            </p>
            <p className="text-xl font-bold">
              ${priceData?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "—"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { refresh(); refreshVaults(); }}
            className="h-10 w-10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setTab("overview")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "overview"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pool Overview
        </button>
        <button
          onClick={() => setTab("position")}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "position"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          My Position
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Stats & Info */}
        <div className="col-span-2 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total Supplied</p>
              <p className="text-lg font-bold">
                ${tvlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total Collateral</p>
              <p className="text-lg font-bold">
                {formatAmount(pool.totalCollateral)} {collateral.symbol}
              </p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-1">LTV Ratio</p>
              <p className="text-lg font-bold text-primary">
                {formatBps(pool.collateralFactor)}
              </p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Liq. Threshold</p>
              <p className="text-lg font-bold text-destructive">
                {formatBps(pool.liquidationFactor)}
              </p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Stability Fee</p>
              <p className="text-lg font-bold text-primary">
                {globalState ? formatBps(globalState.stabilityFee) : "—"}
              </p>
            </div>
          </div>
          
          {tab === "overview" ? (
            <>
              {/* Pool Details */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Pool Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Pool Address</span>
                    <span className="font-mono text-sm">{pool.address.toBase58().slice(0, 8)}...{pool.address.toBase58().slice(-8)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Collateral Mint</span>
                    <span className="font-mono text-sm">{collateral.mint.toBase58().slice(0, 8)}...{collateral.mint.toBase58().slice(-8)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Price Feed</span>
                    <span className="font-mono text-sm">{collateral.priceFeed.toBase58().slice(0, 8)}...{collateral.priceFeed.toBase58().slice(-8)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Decimals</span>
                    <span>{collateral.decimals}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Oracle Source</span>
                    <span className="text-primary">Pyth Network</span>
                  </div>
                </div>
              </div>
              
              {/* Strategy Overview */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Strategy Overview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Deposit {collateral.symbol} as collateral to mint WUSD stablecoin. 
                  Maintain a healthy loan-to-value ratio to avoid liquidation. 
                  The protocol uses real-time Pyth oracle prices for accurate valuations.
                </p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-secondary rounded-full text-xs">CDP</span>
                  <span className="px-3 py-1 bg-secondary rounded-full text-xs">{collateral.symbol}</span>
                  <span className="px-3 py-1 bg-secondary rounded-full text-xs">WUSD</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* My Position */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Your Position</h3>
                {!publicKey ? (
                  <p className="text-muted-foreground text-sm">Connect wallet to view your position</p>
                ) : !userVault || (userVault.collateralShares === 0n && userVault.debtAmount === 0n) ? (
                  <p className="text-muted-foreground text-sm">No position in this pool yet</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Collateral Value</p>
                        <p className="text-xl font-bold">${userCollateralValue.toFixed(2)}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Debt (WUSD)</p>
                        <p className="text-xl font-bold">${userDebtValue.toFixed(2)}</p>
                      </div>
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Health Factor</p>
                        <p className={`text-xl font-bold ${
                          healthFactor > 2 ? "text-green-400" : healthFactor > 1.5 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {healthFactor === Infinity ? "∞" : healthFactor.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-border">
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Collateral Shares</span>
                        <span>{formatLamports(userVault.collateralShares, collateral.decimals)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Accrued Interest</span>
                        <span>${(Number(userVault.accruedInterest) / 1e6).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Borrow Limit</span>
                        <span className="text-primary">${(userCollateralValue * Number(collateral.collateralFactor) / 10000).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Available to Borrow</span>
                        <span className="text-green-400">${Math.max(0, (userCollateralValue * Number(collateral.collateralFactor) / 10000) - userDebtValue).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Right Column - Actions */}
        <div className="space-y-4">
          {/* Wallet Balance */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Wallet Balance</span>
              <div className="flex items-center gap-2">
                <Image src={collateral.image} alt={collateral.symbol} width={20} height={20} className="rounded-full" />
                <span className="font-medium">{walletBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {collateral.symbol}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ≈ ${(walletBalance * (priceData?.price || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          
          {/* Action Panel */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Action Tabs */}
            <div className="grid grid-cols-4 border-b border-border">
              {(["deposit", "withdraw", "mint", "repay"] as ActionTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setActionTab(t); setAmount(""); setTxResult(null); }}
                  className={`py-3 text-xs font-medium capitalize transition-colors ${
                    actionTab === t
                      ? "bg-primary/10 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            
            <div className="p-4 space-y-4">
              {/* Amount Input */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    {actionTab === "deposit" && "You Deposit"}
                    {actionTab === "withdraw" && "You Withdraw"}
                    {actionTab === "mint" && "Mint WUSD"}
                    {actionTab === "repay" && "Repay WUSD"}
                  </span>
                  <span>
                    {actionTab === "deposit" && `Balance: ${walletBalance.toFixed(4)}`}
                    {actionTab === "withdraw" && userVault && pool && pool.totalShares > 0n && (
                      `Available: ${(
                        (Number(userVault.collateralShares) / Number(pool.totalShares)) *
                        (Number(pool.totalCollateral) / Math.pow(10, collateral.decimals))
                      ).toFixed(4)}`
                    )}
                    {actionTab === "mint" && `Max: ${Math.max(0, (userCollateralValue * Number(collateral.collateralFactor) / 10000) - userDebtValue).toFixed(2)}`}
                    {actionTab === "repay" && `Debt: ${userDebtValue.toFixed(2)}`}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-24 bg-secondary border-0 text-lg h-12"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      onClick={() => handleSetAmount(0.5)}
                      className="px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30"
                    >
                      Half
                    </button>
                    <button
                      onClick={() => handleSetAmount(1)}
                      className="px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Transaction Result */}
              {txResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  txResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {txResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span className="text-sm">{txResult.message}</span>
                </div>
              )}
              
              {/* Submit Button */}
              <Button
                onClick={handleTransaction}
                disabled={!publicKey || !amount || txLoading || !pool.isActive}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {!publicKey ? (
                  "Connect Wallet"
                ) : txLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <>
                    {actionTab === "deposit" && "Deposit"}
                    {actionTab === "withdraw" && "Withdraw"}
                    {actionTab === "mint" && "Mint WUSD"}
                    {actionTab === "repay" && "Repay"}
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="bg-card rounded-lg border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold">Transaction Settings</h4>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Slippage</span>
              <span>0.5%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price Impact</span>
              <span className="text-green-400">{"<"}0.01%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
