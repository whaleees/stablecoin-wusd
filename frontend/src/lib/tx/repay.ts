"use client";

import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
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

  const userStableAccount = getAssociatedTokenAddressSync(stablecoinMint, user);

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const ix = await program.methods
    .repay(repayAmount)
    .accounts({
      user,
      collateralMint,
      stablecoinMint,
      userStableAccount,
    })
    .instruction();

  const tx = new Transaction().add(modifyComputeUnits).add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
