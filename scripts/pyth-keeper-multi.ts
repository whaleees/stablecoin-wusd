/**
 * Multi-Asset Pyth Price Keeper
 * 
 * Fetches real prices from Pyth Hermes API and updates on-chain MockPriceFeeds
 * for all configured collateral pools.
 * 
 * Run: npx ts-node scripts/pyth-keeper-multi.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { HermesClient } from "@pythnetwork/hermes-client";
import * as fs from "fs";

// Config
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz");
const UPDATE_INTERVAL_MS = 10_000; // 10 seconds

// Seeds
const SEED_GLOBAL = Buffer.from("global_state");
const SEED_MOCK_PRICE = Buffer.from("mock_price_feed");

// Assets with Pyth feeds
interface AssetConfig {
  symbol: string;
  feedId: string;
  mintAddress: string;
}

// Load from saved config or use defaults
function loadAssetConfigs(): AssetConfig[] {
  try {
    const pythConfig = JSON.parse(fs.readFileSync("./pyth-price-feed.json", "utf8"));
    return pythConfig.map((c: any) => ({
      symbol: c.symbol,
      feedId: c.feedId,
      mintAddress: c.mint,
    }));
  } catch {
    // Default configs
    return [
      {
        symbol: "SOL",
        feedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
        mintAddress: "So11111111111111111111111111111111111111112",
      },
      {
        symbol: "wBTC",
        feedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
        mintAddress: "", // Will be loaded from protocol-addresses.json
      },
      {
        symbol: "wETH",
        feedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
        mintAddress: "",
      },
      {
        symbol: "wSUI",
        feedId: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
        mintAddress: "",
      },
    ];
  }
}

async function main() {
  console.log("🚀 Multi-Asset Pyth Price Keeper Starting...");
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

  // Load asset configs
  const assetConfigs = loadAssetConfigs();
  const validConfigs = assetConfigs.filter(c => c.mintAddress && c.feedId);

  console.log("📋 Assets to update:");
  for (const config of validConfigs) {
    const mint = new PublicKey(config.mintAddress);
    const [priceFeedPda] = PublicKey.findProgramAddressSync(
      [SEED_MOCK_PRICE, mint.toBuffer()],
      PROGRAM_ID
    );
    console.log(`   ${config.symbol}: ${priceFeedPda.toBase58()}`);
  }
  console.log("");

  // Connect to Pyth Hermes
  const hermesClient = new HermesClient("https://hermes.pyth.network");

  console.log("✅ Connected to Pyth Hermes\n");
  console.log("📊 Starting price updates...\n");

  async function updatePrices() {
    for (const config of validConfigs) {
      try {
        // Fetch latest price from Pyth
        const priceUpdates = await hermesClient.getLatestPriceUpdates([config.feedId]);

        if (!priceUpdates?.parsed || priceUpdates.parsed.length === 0) {
          console.log(`⚠️  ${config.symbol}: No price data received`);
          continue;
        }

        const priceFeed = priceUpdates.parsed[0];
        const priceData = priceFeed.price;

        if (!priceData) {
          console.log(`⚠️  ${config.symbol}: Price data is missing`);
          continue;
        }

        // Convert to 8 decimals
        const priceWithDecimals = Number(priceData.price) * Math.pow(10, 8 + priceData.expo);
        const confWithDecimals = Number(priceData.conf) * Math.pow(10, 8 + priceData.expo);

        const priceI64 = BigInt(Math.round(priceWithDecimals));
        const confU64 = BigInt(Math.round(confWithDecimals));

        const mint = new PublicKey(config.mintAddress);
        const [priceFeedPda] = PublicKey.findProgramAddressSync(
          [SEED_MOCK_PRICE, mint.toBuffer()],
          PROGRAM_ID
        );

        // Update on-chain
        const tx = await (program.methods
          .setMockPrice(
            new anchor.BN(priceI64.toString()),
            new anchor.BN(confU64.toString())
          ) as any)
          .accounts({
            admin: walletKeypair.publicKey,
            globalState: globalStatePda,
            collateralMint: mint,
            mockPriceFeed: priceFeedPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const displayPrice = Number(priceData.price) * Math.pow(10, priceData.expo);
        console.log(
          `✅ [${new Date().toLocaleTimeString()}] ${config.symbol}: $${displayPrice.toFixed(2)} (tx: ${tx.slice(0, 12)}...)`
        );
      } catch (error: any) {
        console.error(`❌ ${config.symbol} update failed:`, error.message);
      }
    }
    console.log("---");
  }

  // Initial update
  await updatePrices();

  // Start periodic updates
  setInterval(updatePrices, UPDATE_INTERVAL_MS);

  console.log("\n⏳ Keeper running. Press Ctrl+C to stop.\n");
}

main().catch(console.error);
