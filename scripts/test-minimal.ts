import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import idl from "./anchor.json";

async function testMinimal() {
  console.log("🚀 Starting test…");
  console.log("Using program ID (from IDL):", idl.address);

  const connection = new Connection("http://localhost:8899", "confirmed");

  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(
          `${process.env.HOME}/.config/solana/id.json`,
          "utf-8"
        )
      )
    )
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { commitment: "confirmed" }
  );

  // ✅ EXACTLY like your React hook
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const programId = program.programId;
  console.log("Resolved programId:", programId.toBase58());

  const [testPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("test")],
    programId
  );

  console.log("📦 PDA:", testPda.toBase58());

  const exists = await connection.getAccountInfo(testPda);
  console.log("📊 PDA exists:", !!exists);

  console.log("\n🔄 Calling testMinimal...");
  const sig = await program.methods
    .testMinimal()
    .accounts({
      payer: provider.wallet.publicKey,
      state: testPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Success! Signature:", sig);

  const created = await connection.getAccountInfo(testPda);
  console.log("📊 Account created:", !!created);
}

testMinimal().catch((e) => {
  console.error("❌ Error:", e);
  if (e.logs) {
    console.error("📝 Logs:");
    e.logs.forEach((l: string) => console.error(l));
  }
});
