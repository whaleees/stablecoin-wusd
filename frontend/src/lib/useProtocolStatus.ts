"use client";

import { useEffect, useState } from "react";
import { useProgram } from "@/lib/useProgram";
import { findGlobalStatePda } from "@/lib/pda";

type ProtocolStatus =
  | "program-ready"
  | "rpc-down"
  | "not-initialized"
  | "initialized";

export function useProtocolStatus() {
  const { program, ready } = useProgram();
  const [status, setStatus] = useState<ProtocolStatus>("program-ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !program) return;

    const check = async () => {
      try {
        // 1️⃣ RPC check
        await program.provider.connection.getLatestBlockhash();

        // 2️⃣ GlobalState check
        const [globalStatePda] = findGlobalStatePda(program.programId);

        await program.account.globalState.fetch(globalStatePda);

        setStatus("initialized");
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? "";

        if (msg.includes("fetch") || msg.includes("Account does not exist")) {
          setStatus("not-initialized");
          setError(null);
        } else {
          setStatus("rpc-down");
          setError(msg);
        }
      }
    };

    check();
  }, [ready, program]);

  return { status, error };
}
