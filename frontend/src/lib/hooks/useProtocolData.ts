"use client";

import { useEffect, useState } from "react";
import { useProgram } from "@/lib/useProgram";
import { PublicKey } from "@solana/web3.js";
import { findGlobalStatePda, findPoolRegistryPda } from "@/lib/pda";

export interface GlobalStateData {
  admin: PublicKey;
  stablecoinMint: PublicKey;
  governanceTokenMint: PublicKey;
  totalDebt: bigint;
  debtCeiling: bigint;
  stabilityFee: bigint;
  liquidationPenalty: bigint;
  pools: PublicKey[];
  bump: number;
}

export interface PoolData {
  address: PublicKey;
  mint: PublicKey;
  totalCollateral: bigint;
  totalShares: bigint;
  collateralFactor: bigint;
  liquidationFactor: bigint;
  interestRateModel: PublicKey;
  isActive: boolean;
  bump: number;
}

export interface UserVaultData {
  address: PublicKey;
  owner: PublicKey;
  pool: PublicKey;
  collateralShares: bigint;
  debtAmount: bigint;
  accruedInterest: bigint;
  lastUpdate: bigint;
  bump: number;
}

export function useProtocolData() {
  const { program, ready } = useProgram();
  const [globalState, setGlobalState] = useState<GlobalStateData | null>(null);
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!program) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch global state
      const [globalStatePda] = findGlobalStatePda(program.programId);
      const gs = await program.account.globalState.fetchNullable(globalStatePda);

      if (gs) {
        setGlobalState({
          admin: gs.admin,
          stablecoinMint: gs.stablecoinMint,
          governanceTokenMint: gs.governanceTokenMint,
          totalDebt: BigInt(gs.totalDebt.toString()),
          debtCeiling: BigInt(gs.debtCeiling.toString()),
          stabilityFee: BigInt(gs.stabilityFee.toString()),
          liquidationPenalty: BigInt(gs.liquidationPenalty.toString()),
          pools: gs.pools,
          bump: gs.bump,
        });
      }

      // Fetch all pools
      const poolAccounts = await program.account.collateralPool.all();
      setPools(
        poolAccounts.map((p) => ({
          address: p.publicKey,
          mint: p.account.mint,
          totalCollateral: BigInt(p.account.totalCollateral.toString()),
          totalShares: BigInt(p.account.totalShares.toString()),
          collateralFactor: BigInt(p.account.collateralFactor.toString()),
          liquidationFactor: BigInt(p.account.liquidationFactor.toString()),
          interestRateModel: p.account.interestRateModel,
          isActive: p.account.isActive,
          bump: p.account.bump,
        }))
      );
    } catch (e) {
      console.error("Failed to fetch protocol data:", e);
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) {
      refresh();
    }
  }, [ready, program]);

  return {
    globalState,
    pools,
    loading,
    error,
    initialized: globalState !== null,
    refresh,
  };
}

export function useUserVaults() {
  const { program, ready } = useProgram();
  const [vaults, setVaults] = useState<UserVaultData[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!program || !program.provider.publicKey) return;

    setLoading(true);

    try {
      const userVaults = await program.account.userVault.all([
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: program.provider.publicKey.toBase58(),
          },
        },
      ]);

      setVaults(
        userVaults.map((v) => ({
          address: v.publicKey,
          owner: v.account.owner,
          pool: v.account.pool,
          collateralShares: BigInt(v.account.collateralShares.toString()),
          debtAmount: BigInt(v.account.debtAmount.toString()),
          accruedInterest: BigInt(v.account.accruedInterest.toString()),
          lastUpdate: BigInt(v.account.lastUpdate.toString()),
          bump: v.account.bump,
        }))
      );
    } catch (e) {
      console.error("Failed to fetch user vaults:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && program?.provider.publicKey) {
      refresh();
    }
  }, [ready, program?.provider.publicKey]);

  return {
    vaults,
    loading,
    refresh,
  };
}
