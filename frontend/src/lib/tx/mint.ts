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
} from "@solana/spl-token";
import { findGlobalStatePda, findPoolRegistryPda, findPoolPda, findUserVaultPda, findMintAuthorityPda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function mintStable(params: {
  program: Program<Anchor>;
  user: PublicKey;
  collateralMint: PublicKey;
  stablecoinMint: PublicKey;
  priceFeed: PublicKey;
  stableAmount: BN;
}) {
  const {
    program,
    user,
    collateralMint,
    stablecoinMint,
    priceFeed,
    stableAmount,
  } = params;

  const [globalStatePda] = findGlobalStatePda(program.programId);
  const [poolRegistryPda] = findPoolRegistryPda(program.programId);
  const [poolPda] = findPoolPda(program.programId, collateralMint);
  const [userVaultPda] = findUserVaultPda(program.programId, user, poolPda);
  const [mintAuthorityPda] = findMintAuthorityPda(program.programId);

  const userStableAccount = getAssociatedTokenAddressSync(stablecoinMint, user);

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1,
  });

  const tx = new Transaction().add(modifyComputeUnits).add(addPriorityFee);

  // Check if user's WUSD token account exists, create if not
  const userStableAccountInfo = await program.provider.connection.getAccountInfo(userStableAccount);
  if (!userStableAccountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user,
        userStableAccount,
        user,
        stablecoinMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const ix = await program.methods
    .mintStable(stableAmount)
    .accounts({
      user,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      collateralMint,
      stablecoinMint,
      pool: poolPda,
      userVault: userVaultPda,
      priceFeed,
      userStableAccount,
      mintAuthority: mintAuthorityPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
