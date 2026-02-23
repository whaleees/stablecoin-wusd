"use client";

import { useState } from "react";
import { useProgram } from "@/lib/useProgram";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { initializeGlobal } from "@/lib/tx/initializeGlobal";
import { initializePoolRegistry } from "@/lib/tx/initializePoolRegistry";
import { initializePool } from "@/lib/tx/initializePool";
import { deposit } from "@/lib/tx/deposit";
import { withdraw } from "@/lib/tx/withdraw";
import { mintStable } from "@/lib/tx/mint";
import { repay } from "@/lib/tx/repay";
import { liquidateVault } from "@/lib/tx/liquidateVault";

type InstructionResult = {
  success: boolean;
  message: string;
  signature?: string;
};

function InstructionCard({
  title,
  children,
  onSubmit,
  result,
  loading,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => Promise<void>;
  result: InstructionResult | null;
  loading: boolean;
}) {
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {children}
        <button
          onClick={onSubmit}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium transition-colors"
        >
          {loading ? "Processing..." : "Execute"}
        </button>
        {result && (
          <div
            className={`p-3 rounded text-sm ${
              result.success
                ? "bg-green-900/50 text-green-300"
                : "bg-red-900/50 text-red-300"
            }`}
          >
            <p>{result.message}</p>
            {result.signature && (
              <p className="mt-1 text-xs opacity-70 break-all">
                Sig: {result.signature}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

export default function InstructionsPage() {
  const { program, ready } = useProgram();

  // State for each instruction
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, InstructionResult>>({});

  // Initialize Global State
  const [igStablecoinMint, setIgStablecoinMint] = useState("");
  const [igGovernanceMint, setIgGovernanceMint] = useState("");
  const [igDebtCeiling, setIgDebtCeiling] = useState("1000000000");
  const [igStabilityFee, setIgStabilityFee] = useState("500");
  const [igLiquidationPenalty, setIgLiquidationPenalty] = useState("1000");

  // Initialize Pool
  const [ipCollateralMint, setIpCollateralMint] = useState("");
  const [ipCollateralFactor, setIpCollateralFactor] = useState("15000");
  const [ipLiquidationFactor, setIpLiquidationFactor] = useState("12000");
  const [ipInterestRateModel, setIpInterestRateModel] = useState("");

  // Deposit
  const [depCollateralMint, setDepCollateralMint] = useState("");
  const [depAmount, setDepAmount] = useState("");

  // Withdraw
  const [wdCollateralMint, setWdCollateralMint] = useState("");
  const [wdShares, setWdShares] = useState("");

  // Mint Stable
  const [msCollateralMint, setMsCollateralMint] = useState("");
  const [msStablecoinMint, setMsStablecoinMint] = useState("");
  const [msPriceFeed, setMsPriceFeed] = useState("");
  const [msAmount, setMsAmount] = useState("");

  // Repay
  const [rpCollateralMint, setRpCollateralMint] = useState("");
  const [rpStablecoinMint, setRpStablecoinMint] = useState("");
  const [rpAmount, setRpAmount] = useState("");

  // Liquidate
  const [lqVaultOwner, setLqVaultOwner] = useState("");
  const [lqCollateralMint, setLqCollateralMint] = useState("");
  const [lqStablecoinMint, setLqStablecoinMint] = useState("");
  const [lqPriceFeed, setLqPriceFeed] = useState("");
  const [lqDebtToRepay, setLqDebtToRepay] = useState("");

  const setResult = (key: string, result: InstructionResult) => {
    setResults((prev) => ({ ...prev, [key]: result }));
  };

  const handleError = (key: string, e: unknown) => {
    console.error(e);
    const message = e instanceof Error ? e.message : "Unknown error";
    setResult(key, { success: false, message });
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Connecting to program…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Protocol Instructions</h1>
        <p className="text-gray-400 mb-8">
          Execute all program instructions from this page.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Initialize Global State */}
          <InstructionCard
            title="Initialize Global State"
            result={results["initGlobal"]}
            loading={loading === "initGlobal"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("initGlobal");
              try {
                const sig = await initializeGlobal({
                  program,
                  admin: program.provider.publicKey,
                  stablecoinMint: new PublicKey(igStablecoinMint),
                  governanceTokenMint: new PublicKey(igGovernanceMint),
                  debtCeiling: new BN(igDebtCeiling),
                  stabilityFee: new BN(igStabilityFee),
                  liquidationPenalty: new BN(igLiquidationPenalty),
                });
                setResult("initGlobal", {
                  success: true,
                  message: "Global state initialized!",
                  signature: sig,
                });
              } catch (e) {
                handleError("initGlobal", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <InputField
              label="Stablecoin Mint"
              value={igStablecoinMint}
              onChange={setIgStablecoinMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Governance Token Mint"
              value={igGovernanceMint}
              onChange={setIgGovernanceMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Debt Ceiling"
              value={igDebtCeiling}
              onChange={setIgDebtCeiling}
              type="number"
            />
            <InputField
              label="Stability Fee (bps)"
              value={igStabilityFee}
              onChange={setIgStabilityFee}
              type="number"
            />
            <InputField
              label="Liquidation Penalty (bps)"
              value={igLiquidationPenalty}
              onChange={setIgLiquidationPenalty}
              type="number"
            />
          </InstructionCard>

          {/* Initialize Pool Registry */}
          <InstructionCard
            title="Initialize Pool Registry"
            result={results["initPoolRegistry"]}
            loading={loading === "initPoolRegistry"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("initPoolRegistry");
              try {
                const sig = await initializePoolRegistry({
                  program,
                  admin: program.provider.publicKey,
                });
                setResult("initPoolRegistry", {
                  success: true,
                  message: "Pool registry initialized!",
                  signature: sig,
                });
              } catch (e) {
                handleError("initPoolRegistry", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <p className="text-gray-400 text-sm">
              No additional parameters needed. Uses connected wallet as admin.
            </p>
          </InstructionCard>

          {/* Initialize Pool */}
          <InstructionCard
            title="Initialize Pool"
            result={results["initPool"]}
            loading={loading === "initPool"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("initPool");
              try {
                const sig = await initializePool({
                  program,
                  admin: program.provider.publicKey,
                  collateralMint: new PublicKey(ipCollateralMint),
                  collateralFactor: new BN(ipCollateralFactor),
                  liquidationFactor: new BN(ipLiquidationFactor),
                  interestRateModel: new PublicKey(ipInterestRateModel),
                });
                setResult("initPool", {
                  success: true,
                  message: "Pool initialized!",
                  signature: sig,
                });
              } catch (e) {
                handleError("initPool", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <InputField
              label="Collateral Mint"
              value={ipCollateralMint}
              onChange={setIpCollateralMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Collateral Factor (bps)"
              value={ipCollateralFactor}
              onChange={setIpCollateralFactor}
              type="number"
            />
            <InputField
              label="Liquidation Factor (bps)"
              value={ipLiquidationFactor}
              onChange={setIpLiquidationFactor}
              type="number"
            />
            <InputField
              label="Interest Rate Model"
              value={ipInterestRateModel}
              onChange={setIpInterestRateModel}
              placeholder="PublicKey"
            />
          </InstructionCard>

          {/* Deposit */}
          <InstructionCard
            title="Deposit"
            result={results["deposit"]}
            loading={loading === "deposit"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("deposit");
              try {
                const sig = await deposit({
                  program,
                  user: program.provider.publicKey,
                  collateralMint: new PublicKey(depCollateralMint),
                  collateralAmount: new BN(depAmount),
                });
                setResult("deposit", {
                  success: true,
                  message: "Deposit successful!",
                  signature: sig,
                });
              } catch (e) {
                handleError("deposit", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <InputField
              label="Collateral Mint"
              value={depCollateralMint}
              onChange={setDepCollateralMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Amount"
              value={depAmount}
              onChange={setDepAmount}
              type="number"
            />
          </InstructionCard>

          {/* Withdraw */}
          <InstructionCard
            title="Withdraw"
            result={results["withdraw"]}
            loading={loading === "withdraw"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("withdraw");
              try {
                const sig = await withdraw({
                  program,
                  user: program.provider.publicKey,
                  collateralMint: new PublicKey(wdCollateralMint),
                  sharesToBurn: new BN(wdShares),
                });
                setResult("withdraw", {
                  success: true,
                  message: "Withdrawal successful!",
                  signature: sig,
                });
              } catch (e) {
                handleError("withdraw", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <InputField
              label="Collateral Mint"
              value={wdCollateralMint}
              onChange={setWdCollateralMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Shares to Burn"
              value={wdShares}
              onChange={setWdShares}
              type="number"
            />
          </InstructionCard>

          {/* Mint Stable */}
          <InstructionCard
            title="Mint Stablecoin"
            result={results["mintStable"]}
            loading={loading === "mintStable"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("mintStable");
              try {
                const sig = await mintStable({
                  program,
                  user: program.provider.publicKey,
                  collateralMint: new PublicKey(msCollateralMint),
                  stablecoinMint: new PublicKey(msStablecoinMint),
                  priceFeed: new PublicKey(msPriceFeed),
                  stableAmount: new BN(msAmount),
                });
                setResult("mintStable", {
                  success: true,
                  message: "Stablecoins minted!",
                  signature: sig,
                });
              } catch (e) {
                handleError("mintStable", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <InputField
              label="Collateral Mint"
              value={msCollateralMint}
              onChange={setMsCollateralMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Stablecoin Mint"
              value={msStablecoinMint}
              onChange={setMsStablecoinMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Price Feed"
              value={msPriceFeed}
              onChange={setMsPriceFeed}
              placeholder="Pyth Price Feed PublicKey"
            />
            <InputField
              label="Amount to Mint"
              value={msAmount}
              onChange={setMsAmount}
              type="number"
            />
          </InstructionCard>

          {/* Repay */}
          <InstructionCard
            title="Repay"
            result={results["repay"]}
            loading={loading === "repay"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("repay");
              try {
                const sig = await repay({
                  program,
                  user: program.provider.publicKey,
                  collateralMint: new PublicKey(rpCollateralMint),
                  stablecoinMint: new PublicKey(rpStablecoinMint),
                  repayAmount: new BN(rpAmount),
                });
                setResult("repay", {
                  success: true,
                  message: "Repayment successful!",
                  signature: sig,
                });
              } catch (e) {
                handleError("repay", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <InputField
              label="Collateral Mint"
              value={rpCollateralMint}
              onChange={setRpCollateralMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Stablecoin Mint"
              value={rpStablecoinMint}
              onChange={setRpStablecoinMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Repay Amount"
              value={rpAmount}
              onChange={setRpAmount}
              type="number"
            />
          </InstructionCard>

          {/* Liquidate */}
          <InstructionCard
            title="Liquidate Vault"
            result={results["liquidate"]}
            loading={loading === "liquidate"}
            onSubmit={async () => {
              if (!program?.provider.publicKey) return;
              setLoading("liquidate");
              try {
                const sig = await liquidateVault({
                  program,
                  liquidator: program.provider.publicKey,
                  vaultOwner: new PublicKey(lqVaultOwner),
                  collateralMint: new PublicKey(lqCollateralMint),
                  stablecoinMint: new PublicKey(lqStablecoinMint),
                  priceFeed: new PublicKey(lqPriceFeed),
                  debtToRepay: new BN(lqDebtToRepay),
                });
                setResult("liquidate", {
                  success: true,
                  message: "Liquidation successful!",
                  signature: sig,
                });
              } catch (e) {
                handleError("liquidate", e);
              } finally {
                setLoading(null);
              }
            }}
          >
            <InputField
              label="Vault Owner"
              value={lqVaultOwner}
              onChange={setLqVaultOwner}
              placeholder="PublicKey of vault to liquidate"
            />
            <InputField
              label="Collateral Mint"
              value={lqCollateralMint}
              onChange={setLqCollateralMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Stablecoin Mint"
              value={lqStablecoinMint}
              onChange={setLqStablecoinMint}
              placeholder="PublicKey"
            />
            <InputField
              label="Price Feed"
              value={lqPriceFeed}
              onChange={setLqPriceFeed}
              placeholder="Pyth Price Feed PublicKey"
            />
            <InputField
              label="Debt to Repay"
              value={lqDebtToRepay}
              onChange={setLqDebtToRepay}
              type="number"
            />
          </InstructionCard>
        </div>
      </div>
    </div>
  );
}
