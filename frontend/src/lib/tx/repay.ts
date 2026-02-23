"use client";

import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { findGlobalStatePda, findPoolRegistryPda, findPoolPda, findUserVaultPda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function repay(params: {
  program: Program<Anchor>;
  user: PublicKey;
  collateralMint: PublicKey;
  stablecoinMint: PublicKey;
  repayAmount: BN;
}) {
  const {
    program,
    user,
    collateralMint,
    stablecoinMint,
    repayAmount,
  } = params;

  const [globalStatePda] = findGlobalStatePda(program.programId);
  const [poolRegistryPda] = findPoolRegistryPda(program.programId);
  const [poolPda] = findPoolPda(program.programId, collateralMint);
  const [userVaultPda] = findUserVaultPda(program.programId, user, poolPda);

  const userStableAccount = getAssociatedTokenAddressSync(stablecoinMint, user);

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const ix = await program.methods
    .repay(repayAmount)
    .accounts({
      user,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      collateralMint,
      stablecoinMint,
      pool: poolPda,
      userVault: userVaultPda,
      userStableAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(modifyComputeUnits).add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
