"use client";

import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { findGlobalStatePda, findPoolRegistryPda, findPoolPda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function initializePool(params: {
  program: Program<Anchor>;
  admin: PublicKey;
  collateralMint: PublicKey;
  collateralFactor: BN;
  liquidationFactor: BN;
  interestRateModel: PublicKey;
}) {
  const {
    program,
    admin,
    collateralMint,
    collateralFactor,
    liquidationFactor,
    interestRateModel,
  } = params;

  const [globalStatePda] = findGlobalStatePda(program.programId);
  const [poolRegistryPda] = findPoolRegistryPda(program.programId);
  const [poolPda] = findPoolPda(program.programId, collateralMint);

  // Pool's ATA to hold collateral (owned by pool PDA)
  const poolCollateralAccount = getAssociatedTokenAddressSync(
    collateralMint,
    poolPda,
    true // allowOwnerOffCurve for PDA
  );

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const tx = new Transaction().add(modifyComputeUnits);

  // Create pool's ATA for collateral
  tx.add(
    createAssociatedTokenAccountInstruction(
      admin, // payer
      poolCollateralAccount,
      poolPda, // owner (the pool PDA)
      collateralMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  const ix = await program.methods
    .initializePool(collateralFactor, liquidationFactor, interestRateModel)
    .accounts({
      admin,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      collateralMint,
      pool: poolPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
