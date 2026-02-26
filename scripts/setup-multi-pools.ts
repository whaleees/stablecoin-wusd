/**
 * Multi-Pool Setup Script
 * 
 * Creates collateral pools and price feeds for multiple assets:
 * - SOL (native, using WSOL)
 * - wBTC (wrapped BTC - test token on devnet)
 * - wETH (wrapped ETH - test token on devnet) 
 * - wSUI (wrapped SUI - test token on devnet)
 * - HYPE (test token on devnet)
 * 
 * Usage: npx ts-node scripts/setup-multi-pools.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";

// Program and config
const PROGRAM_ID = new PublicKey("DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz");
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";

// Seeds
const SEED_GLOBAL = Buffer.from("global_state");
const SEED_POOL = Buffer.from("collateral_pool");
const SEED_POOL_REGISTRY = Buffer.from("pool_registry");
const SEED_MOCK_PRICE = Buffer.from("mock_price_feed");

// Collateral configurations
interface CollateralConfig {
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number;        // Price in USD
  pythFeedId: string | null; // Pyth feed ID (null if not available)
  collateralFactor: number;  // LTV in basis points (e.g., 7500 = 75%)
  liquidationFactor: number; // Liquidation threshold in bps (e.g., 8000 = 80%)
  mintAmount: number;        // Amount to mint to admin for testing
}

const COLLATERAL_CONFIGS: CollateralConfig[] = [
  {
    symbol: "SOL",
    name: "Wrapped SOL",
    decimals: 9,
    priceUsd: 77.0,
    pythFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    collateralFactor: 7500,  // 75% LTV
    liquidationFactor: 8000, // 80% liquidation
    mintAmount: 0, // SOL is native, don't mint
  },
  {
    symbol: "wBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    priceUsd: 96000.0,
    pythFeedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    collateralFactor: 7000,  // 70% LTV
    liquidationFactor: 7500, // 75% liquidation
    mintAmount: 10, // 10 BTC for testing
  },
  {
    symbol: "wETH",
    name: "Wrapped Ethereum",
    decimals: 8,
    priceUsd: 2700.0,
    pythFeedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    collateralFactor: 7500,  // 75% LTV
    liquidationFactor: 8000, // 80% liquidation
    mintAmount: 100, // 100 ETH for testing
  },
  {
    symbol: "wSUI",
    name: "Wrapped Sui",
    decimals: 9,
    priceUsd: 3.50,
    pythFeedId: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    collateralFactor: 6500,  // 65% LTV
    liquidationFactor: 7000, // 70% liquidation
    mintAmount: 10000, // 10K SUI for testing
  },
  {
    symbol: "HYPE",
    name: "Hyperliquid",
    decimals: 8,
    priceUsd: 18.0,
    pythFeedId: null, // No Pyth feed, mock only
    collateralFactor: 5000,  // 50% LTV (more volatile)
    liquidationFactor: 6000, // 60% liquidation
    mintAmount: 5000, // 5K HYPE for testing
  },
];

// WSOL mint (native)
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

interface PoolSetupResult {
  symbol: string;
  mint: PublicKey;
  pool: PublicKey;
  priceFeed: PublicKey;
}

async function main() {
  console.log("🚀 Multi-Pool Setup Script");
  console.log("   RPC:", RPC_URL);
  console.log("");

  const connection = new Connection(RPC_URL, "confirmed");

  // Load admin wallet
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(
          process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`,
          "utf8"
        )
      )
    )
  );

  const wallet = new anchor.Wallet(adminKeypair);
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
  const [poolRegistryPda] = PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    PROGRAM_ID
  );

  console.log("📋 Admin:", adminKeypair.publicKey.toBase58());
  console.log("   GlobalState:", globalStatePda.toBase58());
  console.log("   PoolRegistry:", poolRegistryPda.toBase58());
  console.log("");

  // Results storage
  const results: PoolSetupResult[] = [];
  const mintAddresses: Record<string, string> = {};

  // Process each collateral
  for (const config of COLLATERAL_CONFIGS) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 Setting up ${config.symbol} (${config.name})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let mint: PublicKey;

    // Create or use existing mint
    if (config.symbol === "SOL") {
      mint = WSOL_MINT;
      console.log(`   Using native WSOL: ${mint.toBase58()}`);
    } else {
      // Check if mint already exists in saved addresses
      const savedAddresses = loadSavedAddresses();
      if (savedAddresses[`${config.symbol}_MINT`]) {
        mint = new PublicKey(savedAddresses[`${config.symbol}_MINT`]);
        console.log(`   Using existing mint: ${mint.toBase58()}`);
      } else {
        // Create new mint
        console.log(`   Creating new ${config.symbol} mint...`);
        mint = await createMint(
          connection,
          adminKeypair,
          adminKeypair.publicKey,
          null,
          config.decimals
        );
        console.log(`   ✅ Mint created: ${mint.toBase58()}`);

        // Mint tokens to admin for testing
        if (config.mintAmount > 0) {
          const adminAta = await getOrCreateAssociatedTokenAccount(
            connection,
            adminKeypair,
            mint,
            adminKeypair.publicKey
          );
          
          const mintAmountWithDecimals = BigInt(config.mintAmount) * BigInt(10 ** config.decimals);
          await mintTo(
            connection,
            adminKeypair,
            mint,
            adminAta.address,
            adminKeypair,
            mintAmountWithDecimals
          );
          console.log(`   ✅ Minted ${config.mintAmount} ${config.symbol} to admin`);
        }
      }
    }

    mintAddresses[`${config.symbol}_MINT`] = mint.toBase58();

    // Derive pool PDA
    const [poolPda] = PublicKey.findProgramAddressSync(
      [SEED_POOL, mint.toBuffer()],
      PROGRAM_ID
    );

    // Derive price feed PDA (now includes collateral mint)
    const [priceFeedPda] = PublicKey.findProgramAddressSync(
      [SEED_MOCK_PRICE, mint.toBuffer()],
      PROGRAM_ID
    );

    console.log(`   Pool PDA: ${poolPda.toBase58()}`);
    console.log(`   PriceFeed PDA: ${priceFeedPda.toBase58()}`);

    // Check if pool exists
    const poolInfo = await connection.getAccountInfo(poolPda);
    if (poolInfo) {
      console.log(`   ⚠️  Pool already exists, skipping creation`);
    } else {
      // Initialize pool
      console.log(`   Creating pool...`);
      try {
        const tx = await (program.methods
          .initializePool(
            new anchor.BN(config.collateralFactor),
            new anchor.BN(config.liquidationFactor),
            PublicKey.default // interest rate model (placeholder)
          ) as any)
          .accounts({
            admin: adminKeypair.publicKey,
            globalState: globalStatePda,
            poolRegistry: poolRegistryPda,
            collateralMint: mint,
            pool: poolPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        console.log(`   ✅ Pool created: ${tx.slice(0, 16)}...`);
      } catch (e: any) {
        console.log(`   ❌ Pool creation failed: ${e.message}`);
      }
    }

    // Set mock price
    console.log(`   Setting price: $${config.priceUsd}`);
    const priceWithDecimals = BigInt(Math.round(config.priceUsd * 100_000_000)); // 8 decimals
    const confWithDecimals = BigInt(Math.round(config.priceUsd * 1_000_000)); // 1% confidence

    try {
      const tx = await (program.methods
        .setMockPrice(
          new anchor.BN(priceWithDecimals.toString()),
          new anchor.BN(confWithDecimals.toString())
        ) as any)
        .accounts({
          admin: adminKeypair.publicKey,
          globalState: globalStatePda,
          collateralMint: mint,
          mockPriceFeed: priceFeedPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`   ✅ Price set: $${config.priceUsd} (tx: ${tx.slice(0, 16)}...)`);
    } catch (e: any) {
      console.log(`   ❌ Price setting failed: ${e.message}`);
    }

    results.push({
      symbol: config.symbol,
      mint,
      pool: poolPda,
      priceFeed: priceFeedPda,
    });
  }

  // Save addresses
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📝 Summary & Addresses");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const outputAddresses: Record<string, string> = {
    PROGRAM_ID: PROGRAM_ID.toBase58(),
    GLOBAL_STATE: globalStatePda.toBase58(),
    POOL_REGISTRY: poolRegistryPda.toBase58(),
  };

  for (const result of results) {
    console.log(`${result.symbol}:`);
    console.log(`  Mint:      ${result.mint.toBase58()}`);
    console.log(`  Pool:      ${result.pool.toBase58()}`);
    console.log(`  PriceFeed: ${result.priceFeed.toBase58()}`);
    console.log("");

    outputAddresses[`${result.symbol}_MINT`] = result.mint.toBase58();
    outputAddresses[`${result.symbol}_POOL`] = result.pool.toBase58();
    outputAddresses[`${result.symbol}_PRICE_FEED`] = result.priceFeed.toBase58();
  }

  // Save to file
  fs.writeFileSync(
    "./protocol-addresses.json",
    JSON.stringify(outputAddresses, null, 2)
  );
  console.log("✅ Addresses saved to protocol-addresses.json");

  // Generate config for Pyth feeds
  const pythConfig = COLLATERAL_CONFIGS
    .filter(c => c.pythFeedId)
    .map(c => ({
      symbol: c.symbol,
      feedId: c.pythFeedId,
      mint: outputAddresses[`${c.symbol}_MINT`],
      priceFeed: outputAddresses[`${c.symbol}_PRICE_FEED`],
    }));

  fs.writeFileSync(
    "./pyth-price-feed.json",
    JSON.stringify(pythConfig, null, 2)
  );
  console.log("✅ Pyth config saved to pyth-price-feed.json\n");
}

function loadSavedAddresses(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync("./protocol-addresses.json", "utf8"));
  } catch {
    return {};
  }
}

main().catch(console.error);
