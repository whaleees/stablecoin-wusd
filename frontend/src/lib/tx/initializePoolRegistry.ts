"use client";

import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { Anchor } from "@/lib/types/anchor";

export async function initializePoolRegistry(params: {
  program: Program<Anchor>;
  admin: PublicKey;
}) {
  const { program, admin } = params;

  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const ix = await program.methods
    .initializePoolRegistry()
    .accounts({
      admin,
    })
    .instruction();

  const tx = new Transaction().add(modifyComputeUnits).add(ix);

  return program.provider.sendAndConfirm!(tx, []);
}
