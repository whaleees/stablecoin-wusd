"use client";

import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { findGlobalStatePda, findPoolRegistryPda, findPoolPda, findUserVaultPda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function deposit(params: {
  program: Program<Anchor>;
  user: PublicKey;
  collateralMint: PublicKey;
  collateralAmount: BN;
}) {
  const {
    program,
    user,
    collateralMint,
    collateralAmount,
  } = params;

  const [globalStatePda] = findGlobalStatePda(program.programId);
  const [poolRegistryPda] = findPoolRegistryPda(program.programId);
  const [poolPda] = findPoolPda(program.programId, collateralMint);
  const [userVaultPda] = findUserVaultPda(program.programId, user, poolPda);

  const userCollateralAccount = getAssociatedTokenAddressSync(collateralMint, user);
  const poolCollateralAccount = getAssociatedTokenAddressSync(collateralMint, poolPda, true);

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const tx = new Transaction().add(modifyComputeUnits);

  const connection = program.provider.connection;

  // Check if this is native SOL (wrapped SOL)
  const isNativeSol = collateralMint.equals(NATIVE_MINT);

  // Check if pool's ATA exists, if not create it
  const poolAtaInfo = await connection.getAccountInfo(poolCollateralAccount);
  if (!poolAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user, // payer
        poolCollateralAccount,
        poolPda, // owner (the pool PDA)
        collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Check if user's ATA exists, if not create it
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

  // For native SOL, we need to wrap SOL into the WSOL account
  if (isNativeSol) {
    // Transfer SOL to the WSOL account
    tx.add(
      SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: userCollateralAccount,
        lamports: collateralAmount.toNumber(),
      })
    );
    // Sync the native account to update the token balance
    tx.add(createSyncNativeInstruction(userCollateralAccount));
  }

  const ix = await program.methods
    .deposit(collateralAmount)
    .accounts({
      user,
      pool: poolPda,
      userVault: userVaultPda,
      userCollateralAccount,
      poolCollateralAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
