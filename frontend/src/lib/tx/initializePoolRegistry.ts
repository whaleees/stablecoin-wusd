"use client";

import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { findPoolRegistryPda } from "@/lib/pda";
import { Anchor } from "@/lib/types/anchor";

export async function initializePoolRegistry(params: {
  program: Program<Anchor>;
  admin: PublicKey;
}) {
  const { program, admin } = params;

  const [poolRegistryPda] = findPoolRegistryPda(program.programId);

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const ix = await program.methods
    .initializePoolRegistry()
    .accounts({
      admin,
      poolRegistry: poolRegistryPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(modifyComputeUnits).add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
