/**
 * Setup Script: Create SPL token, create ATA, and mint tokens
 * 
 * Usage: npx ts-node scripts/setup-test-token.ts
 * 
 * This script creates a new SPL token mint, creates an associated token account
 * for the user, and mints test tokens. Useful after resetting local validator.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Configuration
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const MINT_DECIMALS = 9;
const MINT_AMOUNT = 1_000_000; // 1 million tokens

// Paths to save/load keypairs
const OUTPUT_DIR = path.join(__dirname, "..", "test-keys");
const COLLATERAL_MINT_PATH = path.join(OUTPUT_DIR, "collateral-mint.json");
const USER_KEYPAIR_PATH = path.join(OUTPUT_DIR, "user.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveKeypair(keypair: Keypair, filePath: string) {
  fs.writeFileSync(filePath, JSON.stringify(Array.from(keypair.secretKey)));
  console.log(`  Saved keypair to ${filePath}`);
}

function loadKeypair(filePath: string): Keypair | null {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(data));
  }
  return null;
}

function loadDefaultKeypair(): Keypair {
  // Try loading from default Solana CLI path
  const defaultPath = path.join(process.env.HOME || "~", ".config/solana/id.json");
  if (fs.existsSync(defaultPath)) {
    const data = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(data));
  }
  throw new Error("Default keypair not found at ~/.config/solana/id.json");
}

async function airdropIfNeeded(connection: Connection, publicKey: PublicKey, minBalance: number = 2 * LAMPORTS_PER_SOL) {
  const balance = await connection.getBalance(publicKey);
  if (balance < minBalance) {
    console.log(`  Airdropping SOL to ${publicKey.toBase58()}...`);
    const sig = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    console.log(`  Airdrop confirmed: ${sig.slice(0, 20)}...`);
  } else {
    console.log(`  Balance OK: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  }
}

async function main() {
  console.log("\n🚀 SPL Token Setup Script");
  console.log("=".repeat(50));
  console.log(`RPC: ${RPC_URL}`);

  const connection = new Connection(RPC_URL, "confirmed");

  // Ensure output directory exists
  ensureDir(OUTPUT_DIR);

  // Load or use default user keypair
  console.log("\n📋 Loading User Keypair...");
  let userKeypair = loadKeypair(USER_KEYPAIR_PATH);
  if (!userKeypair) {
    userKeypair = loadDefaultKeypair();
    saveKeypair(userKeypair, USER_KEYPAIR_PATH);
  }
  console.log(`  User: ${userKeypair.publicKey.toBase58()}`);

  // Airdrop SOL if needed
  await airdropIfNeeded(connection, userKeypair.publicKey);

  // Create or load collateral mint
  console.log("\n🪙 Setting up Collateral Mint...");
  let collateralMint: PublicKey;
  const existingMintKeypair = loadKeypair(COLLATERAL_MINT_PATH);

  if (existingMintKeypair) {
    // Check if mint exists on-chain
    try {
      const mintInfo = await getMint(connection, existingMintKeypair.publicKey);
      collateralMint = existingMintKeypair.publicKey;
      console.log(`  Using existing mint: ${collateralMint.toBase58()}`);
      console.log(`  Supply: ${Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)}`);
    } catch {
      // Mint doesn't exist on-chain (validator was reset), create new one
      console.log("  Existing mint not found on-chain, creating new mint...");
      const newMintKeypair = Keypair.generate();
      collateralMint = await createMint(
        connection,
        userKeypair,
        userKeypair.publicKey, // mint authority
        userKeypair.publicKey, // freeze authority
        MINT_DECIMALS,
        newMintKeypair,
        undefined,
        TOKEN_PROGRAM_ID
      );
      saveKeypair(newMintKeypair, COLLATERAL_MINT_PATH);
      console.log(`  Created new mint: ${collateralMint.toBase58()}`);
    }
  } else {
    // First time - create new mint
    console.log("  Creating new collateral mint...");
    const mintKeypair = Keypair.generate();
    collateralMint = await createMint(
      connection,
      userKeypair,
      userKeypair.publicKey, // mint authority
      userKeypair.publicKey, // freeze authority
      MINT_DECIMALS,
      mintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );
    saveKeypair(mintKeypair, COLLATERAL_MINT_PATH);
    console.log(`  Created mint: ${collateralMint.toBase58()}`);
  }

  // Create or get user's token account
  console.log("\n💼 Setting up User Token Account...");
  const userAta = await getOrCreateAssociatedTokenAccount(
    connection,
    userKeypair,
    collateralMint,
    userKeypair.publicKey
  );
  console.log(`  User ATA: ${userAta.address.toBase58()}`);
  console.log(`  Current balance: ${Number(userAta.amount) / Math.pow(10, MINT_DECIMALS)}`);

  // Mint tokens if balance is low
  const mintThreshold = BigInt(MINT_AMOUNT * Math.pow(10, MINT_DECIMALS) / 2);
  if (userAta.amount < mintThreshold) {
    console.log("\n💰 Minting Test Tokens...");
    const mintAmount = BigInt(MINT_AMOUNT) * BigInt(Math.pow(10, MINT_DECIMALS));
    const sig = await mintTo(
      connection,
      userKeypair,
      collateralMint,
      userAta.address,
      userKeypair, // mint authority
      mintAmount
    );
    console.log(`  Minted ${MINT_AMOUNT.toLocaleString()} tokens`);
    console.log(`  Tx: ${sig.slice(0, 20)}...`);

    // Verify
    const updatedAta = await getOrCreateAssociatedTokenAccount(
      connection,
      userKeypair,
      collateralMint,
      userKeypair.publicKey
    );
    console.log(`  New balance: ${Number(updatedAta.amount) / Math.pow(10, MINT_DECIMALS)}`);
  } else {
    console.log("\n✅ Sufficient token balance, skipping mint");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📋 SUMMARY - Add these to your .env.local:");
  console.log("=".repeat(50));
  console.log(`\nNEXT_PUBLIC_COLLATERAL_MINT=${collateralMint.toBase58()}`);
  console.log(`USER_PUBKEY=${userKeypair.publicKey.toBase58()}`);
  console.log(`USER_ATA=${userAta.address.toBase58()}`);

  // Save addresses to a JSON file for easy reference
  const addressesPath = path.join(OUTPUT_DIR, "addresses.json");
  fs.writeFileSync(
    addressesPath,
    JSON.stringify(
      {
        collateralMint: collateralMint.toBase58(),
        userPubkey: userKeypair.publicKey.toBase58(),
        userAta: userAta.address.toBase58(),
        rpcUrl: RPC_URL,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`\n✅ Addresses saved to ${addressesPath}`);
  console.log("\n🎉 Setup complete!\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
