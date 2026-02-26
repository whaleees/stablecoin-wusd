/**
 * Pyth Price Keeper
 * 
 * This script fetches real prices from Pyth Hermes API and updates
 * the on-chain MockPriceFeed to keep it in sync with real market prices.
 * 
 * Run: npx ts-node scripts/pyth-keeper.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { HermesClient } from "@pythnetwork/hermes-client";
import * as fs from "fs";

// Config
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz");
const UPDATE_INTERVAL_MS = 10_000; // 10 seconds

// Pyth Feed IDs
const PYTH_FEEDS = {
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

// Seeds
const SEED_GLOBAL = Buffer.from("global_state");
const SEED_MOCK_PRICE = Buffer.from("mock_price_feed");

async function main() {
  console.log("🚀 Pyth Price Keeper Starting...");
  console.log("   RPC:", RPC_URL);
  console.log("   Update interval:", UPDATE_INTERVAL_MS / 1000, "seconds");
  console.log("");

  const connection = new Connection(RPC_URL, "confirmed");
  
  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(
          process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`,
          "utf8"
        )
      )
    )
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idl = JSON.parse(
    fs.readFileSync("./anchor/target/idl/anchor.json", "utf8")
  );
  const program = new anchor.Program(idl, provider);

  // PDAs
  const [globalStatePda] = PublicKey.findProgramAddressSync(
    [SEED_GLOBAL],
    PROGRAM_ID
  );
  const [mockPriceFeedPda] = PublicKey.findProgramAddressSync(
    [SEED_MOCK_PRICE],
    PROGRAM_ID
  );

  console.log("📋 Addresses:");
  console.log("   Admin:", walletKeypair.publicKey.toBase58());
  console.log("   GlobalState:", globalStatePda.toBase58());
  console.log("   MockPriceFeed:", mockPriceFeedPda.toBase58());
  console.log("");

  // Connect to Pyth Hermes
  const hermesClient = new HermesClient("https://hermes.pyth.network");

  console.log("✅ Connected to Pyth Hermes\n");
  console.log("📊 Starting price updates...\n");

  async function updatePrice() {
    try {
      // Fetch latest price from Pyth
      const priceUpdates = await hermesClient.getLatestPriceUpdates([PYTH_FEEDS.SOL]);
      
      if (!priceUpdates?.parsed || priceUpdates.parsed.length === 0) {
        console.log("⚠️  No price feed data received");
        return;
      }

      const priceFeed = priceUpdates.parsed[0];
      const priceData = priceFeed.price;
      
      if (!priceData) {
        console.log("⚠️  Price data is missing");
        return;
      }

      // Convert to 8 decimals (Pyth uses exponent, typically -8)
      const priceWithDecimals = Number(priceData.price) * Math.pow(10, 8 + priceData.expo);
      const confWithDecimals = Number(priceData.conf) * Math.pow(10, 8 + priceData.expo);
      
      const priceI64 = BigInt(Math.round(priceWithDecimals));
      const confU64 = BigInt(Math.round(confWithDecimals));

      // Update on-chain MockPriceFeed
      const tx = await (program.methods
        .setMockPrice(new anchor.BN(priceI64.toString()), new anchor.BN(confU64.toString())) as any)
        .accounts({
          admin: walletKeypair.publicKey,
          globalState: globalStatePda,
          mockPriceFeed: mockPriceFeedPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const displayPrice = Number(priceData.price) * Math.pow(10, priceData.expo);
      console.log(
        `✅ [${new Date().toLocaleTimeString()}] SOL/USD: $${displayPrice.toFixed(2)} (tx: ${tx.slice(0, 16)}...)`
      );
    } catch (error: any) {
      console.error("❌ Update failed:", error.message);
    }
  }

  // Initial update
  await updatePrice();

  // Start periodic updates
  setInterval(updatePrice, UPDATE_INTERVAL_MS);

  console.log("\n⏳ Keeper running. Press Ctrl+C to stop.\n");
}

main().catch(console.error);
