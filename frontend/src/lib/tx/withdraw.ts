"use client";

import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import { findGlobalStatePda, findPoolRegistryPda, findPoolPda, findUserVaultPda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function withdraw(params: {
  program: Program<Anchor>;
  user: PublicKey;
  collateralMint: PublicKey;
  sharesToBurn: BN;
  closeWsolAccount?: boolean; // Optional: close WSOL account after withdraw to get SOL back
}) {
  const {
    program,
    user,
    collateralMint,
    sharesToBurn,
    closeWsolAccount = true, // Default to closing to get SOL back
  } = params;

  const [poolPda] = findPoolPda(program.programId, collateralMint);
  const [userVaultPda] = findUserVaultPda(program.programId, user, poolPda);

  const userCollateralAccount = getAssociatedTokenAddressSync(collateralMint, user);
  const poolCollateralAccount = getAssociatedTokenAddressSync(collateralMint, poolPda, true);

  // Check if this is native SOL (wrapped SOL)
  const isNativeSol = collateralMint.equals(NATIVE_MINT);

  // Debug logging
  console.log("Withdraw Debug:");
  console.log("  User:", user.toBase58());
  console.log("  Collateral Mint:", collateralMint.toBase58());
  console.log("  Is Native SOL:", isNativeSol);
  console.log("  Pool PDA:", poolPda.toBase58());
  console.log("  User Vault PDA:", userVaultPda.toBase58());
  console.log("  User Collateral Account:", userCollateralAccount.toBase58());
  console.log("  Pool Collateral Account:", poolCollateralAccount.toBase58());

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1,
  });

  const tx = new Transaction().add(modifyComputeUnits).add(addPriorityFee);

  // Check if user's ATA exists, if not create it
  const connection = program.provider.connection;
  const ataInfo = await connection.getAccountInfo(userCollateralAccount);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user,
        userCollateralAccount,
        user,
        collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Verify vault exists before attempting withdraw
  const vaultInfo = await connection.getAccountInfo(userVaultPda);
  if (!vaultInfo) {
    throw new Error("User vault not found. You need to deposit first.");
  }

  const ix = await program.methods
    .withdraw(sharesToBurn)
    .accounts({
      user,
      pool: poolPda,
      userVault: userVaultPda,
      userCollateralAccount,
      poolCollateralAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(ix);

  // For native SOL, optionally close the WSOL account to unwrap SOL back to native
  if (isNativeSol && closeWsolAccount) {
    tx.add(
      createCloseAccountInstruction(
        userCollateralAccount, // account to close
        user, // destination for lamports
        user, // authority
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  return program.provider.sendAndConfirm!(tx, []);
}
