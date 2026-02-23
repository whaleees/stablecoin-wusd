"use client";

import { useMemo } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";

import idl from "@/lib/idl/anchor.json";
import { Anchor } from "@/lib/types/anchor"; 

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const programId = useMemo(() => {
    const id = process.env.NEXT_PUBLIC_PROGRAM_ID;
    if (!id) throw new Error("NEXT_PUBLIC_PROGRAM_ID is not set");
    return new PublicKey(id);
  }, []);

  const provider = useMemo(() => {
    if (!wallet) return null;
    return new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;

    return new anchor.Program<Anchor>(
      idl as anchor.Idl,
      provider
    );
  }, [provider, programId]);

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "localnet";

  return {
    program,
    programId,
    provider,
    cluster,
    ready: !!program,
  };
}
