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
      collateralMint,
      stablecoinMint,
      priceFeed,
      userStableAccount,
    })
    .instruction();

  tx.add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
