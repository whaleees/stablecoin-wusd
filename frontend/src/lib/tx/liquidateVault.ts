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
import { findPoolPda, findUserVaultPda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function liquidateVault(params: {
  program: Program<Anchor>;
  liquidator: PublicKey;
  vaultOwner: PublicKey;
  collateralMint: PublicKey;
  stablecoinMint: PublicKey;
  priceFeed: PublicKey;
  debtToRepay: BN;
}) {
  const {
    program,
    liquidator,
    vaultOwner,
    collateralMint,
    stablecoinMint,
    priceFeed,
    debtToRepay,
  } = params;

  const [poolPda] = findPoolPda(program.programId, collateralMint);
  const [userVaultPda] = findUserVaultPda(program.programId, vaultOwner, poolPda);

  const liquidatorStableAccount = getAssociatedTokenAddressSync(stablecoinMint, liquidator);
  const liquidatorCollateralAccount = getAssociatedTokenAddressSync(collateralMint, liquidator);
  const poolCollateralAccount = getAssociatedTokenAddressSync(collateralMint, poolPda, true);

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const tx = new Transaction().add(modifyComputeUnits);

  // Check if liquidator's collateral ATA exists, if not create it
  const connection = program.provider.connection;
  const ataInfo = await connection.getAccountInfo(liquidatorCollateralAccount);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        liquidator,
        liquidatorCollateralAccount,
        liquidator,
        collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const ix = await program.methods
    .liquidateVault(debtToRepay)
    .accountsPartial({
      liquidator,
      collateralMint,
      stablecoinMint,
      userVault: userVaultPda,
      priceFeed,
      liquidatorStableAccount,
      liquidatorCollateralAccount,
      poolCollateralAccount,
    })
    .instruction();

  tx.add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
