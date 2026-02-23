"use client";

import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { findGlobalStatePda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function initializeGlobal(params: {
  program: Program<Anchor>;
  admin: PublicKey;
  stablecoinMint: PublicKey;
  governanceTokenMint: PublicKey;
  debtCeiling: BN;
  stabilityFee: BN;
  liquidationPenalty: BN;
}) {
  const {
    program,
    admin,
    stablecoinMint,
    governanceTokenMint,
    debtCeiling,
    stabilityFee,
    liquidationPenalty,
  } = params;

  const [globalStatePda] = findGlobalStatePda(program.programId);

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const initIx = await program.methods
    .initializeGlobalState(debtCeiling, stabilityFee, liquidationPenalty)
    .accounts({
      admin,
      globalState: globalStatePda,
      stablecoinMint,
      governanceTokenMint,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(modifyComputeUnits).add(initIx);

  return program.provider.sendAndConfirm!(tx, []);
}
