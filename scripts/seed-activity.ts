import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  transfer,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as fs from "fs";

const SEED_GLOBAL = Buffer.from("global_state");
const SEED_POOL = Buffer.from("collateral_pool");
const SEED_VAULT = Buffer.from("user_vault");
const SEED_POOL_REGISTRY = Buffer.from("pool_registry");
const SEED_MINT_AUTHORITY = Buffer.from("mint_authority");

const DEFAULT_BASE_PRICES: Record<string, number> = {
  SOL: 77,
  wBTC: 96000,
  wETH: 2700,
  wSUI: 3.5,
  HYPE: 18,
};

interface CliOptions {
  users: number;
  liquidations: number;
  symbols: string[];
  risky: boolean;
}

interface AddressMap {
  PROGRAM_ID: string;
  GLOBAL_STATE: string;
  [key: string]: string;
}

interface PoolSeedConfig {
  symbol: string;
  mint: PublicKey;
  priceFeed: PublicKey;
  basePrice: number;
  decimals: number;
  collateralFactorBps: number;
  liquidationFactorBps: number;
}

interface Position {
  user: Keypair;
  symbol: string;
  mint: PublicKey;
  priceFeed: PublicKey;
}

interface SeedStats {
  usersSeeded: number;
  depositsOk: number;
  mintsOk: number;
  repaysOk: number;
  liquidationsOk: number;
}

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  const getArg = (name: string, fallback: number): number => {
    const idx = args.findIndex((v) => v === `--${name}`);
    if (idx === -1 || idx + 1 >= args.length) return fallback;
    const parsed = Number(args[idx + 1]);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  };

  return {
    users: getArg("users", 24),
    liquidations: getArg("liquidations", 5),
    symbols: (() => {
      const idx = args.findIndex((v) => v === "--symbols");
      if (idx === -1 || idx + 1 >= args.length) return ["SOL", "wBTC", "wETH", "wSUI"];
      return args[idx + 1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    })(),
    risky: args.includes("--risky"),
  };
}

function loadAdminKeypair(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function loadAddresses(): AddressMap {
  return JSON.parse(fs.readFileSync("./protocol-addresses.json", "utf8")) as AddressMap;
}

function toUnits(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * 10 ** decimals));
}

function fromUnits(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function findPoolPda(programId: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_POOL, mint.toBuffer()], programId)[0];
}

function findVaultPda(programId: PublicKey, owner: PublicKey, pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_VAULT, owner.toBuffer(), pool.toBuffer()],
    programId
  )[0];
}

async function ensureUserFunding(
  connection: Connection,
  admin: Keypair,
  user: Keypair,
  sol: number
): Promise<void> {
  const lamports = Math.floor(sol * LAMPORTS_PER_SOL);
  const ix = SystemProgram.transfer({
    fromPubkey: admin.publicKey,
    toPubkey: user.publicKey,
    lamports,
  });

  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [admin], {
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, "confirmed");
}

async function safeRun<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err: any) {
    console.warn(`   ⚠️ ${label} failed: ${err?.message || String(err)}`);
    return null;
  }
}

async function seedCollateralToUser(
  connection: Connection,
  admin: Keypair,
  user: PublicKey,
  mint: PublicKey,
  amountUi: number,
  decimals: number
): Promise<void> {
  if (mint.equals(NATIVE_MINT)) {
    return;
  }

  const adminAta = await getOrCreateAssociatedTokenAccount(
    connection,
    admin,
    mint,
    admin.publicKey
  );
  const ata = await getOrCreateAssociatedTokenAccount(connection, admin, mint, user);
  const amount = toUnits(amountUi, decimals);
  const adminBalance = BigInt(adminAta.amount.toString());
  if (adminBalance < amount) {
    throw new Error(
      `Admin has insufficient ${mint.toBase58()} balance (${adminBalance.toString()} < ${amount.toString()})`
    );
  }

  await transfer(connection, admin, adminAta.address, ata.address, admin.publicKey, amount);
}

async function sendDeposit(
  program: anchor.Program,
  user: Keypair,
  collateralMint: PublicKey,
  collateralAmount: bigint
): Promise<void> {
  const [globalStatePda] = PublicKey.findProgramAddressSync([SEED_GLOBAL], program.programId);
  const [poolRegistryPda] = PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    program.programId
  );

  const poolPda = findPoolPda(program.programId, collateralMint);
  const userVault = findVaultPda(program.programId, user.publicKey, poolPda);
  const userCollateralAccount = getAssociatedTokenAddressSync(collateralMint, user.publicKey);
  const poolCollateralAccount = getAssociatedTokenAddressSync(collateralMint, poolPda, true);

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000 })
  );

  const poolAtaInfo = await program.provider.connection.getAccountInfo(poolCollateralAccount);
  if (!poolAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        poolCollateralAccount,
        poolPda,
        collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const userAtaInfo = await program.provider.connection.getAccountInfo(userCollateralAccount);
  if (!userAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userCollateralAccount,
        user.publicKey,
        collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  if (collateralMint.equals(NATIVE_MINT)) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: user.publicKey,
        toPubkey: userCollateralAccount,
        lamports: Number(collateralAmount),
      }),
      createSyncNativeInstruction(userCollateralAccount)
    );
  }

  const depositIx = await program.methods
    .deposit(new anchor.BN(collateralAmount.toString()))
    .accountsPartial({
      user: user.publicKey,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      userCollateralAccount,
      poolCollateralAccount,
      pool: poolPda,
      userVault,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(depositIx);
  await (program.provider as anchor.AnchorProvider).sendAndConfirm(tx, [user]);
}

async function sendMintStable(
  program: anchor.Program,
  user: Keypair,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  priceFeed: PublicKey,
  stableAmount: bigint
): Promise<void> {
  const [globalStatePda] = PublicKey.findProgramAddressSync([SEED_GLOBAL], program.programId);
  const [poolRegistryPda] = PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    program.programId
  );
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
    [SEED_MINT_AUTHORITY],
    program.programId
  );
  const poolPda = findPoolPda(program.programId, collateralMint);
  const userVault = findVaultPda(program.programId, user.publicKey, poolPda);
  const userStableAccount = getAssociatedTokenAddressSync(stablecoinMint, user.publicKey);
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000 })
  );

  const stableAtaInfo = await program.provider.connection.getAccountInfo(userStableAccount);
  if (!stableAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userStableAccount,
        user.publicKey,
        stablecoinMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const ix = await program.methods
    .mintStable(new anchor.BN(stableAmount.toString()))
    .accountsPartial({
      user: user.publicKey,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      collateralMint,
      stablecoinMint,
      pool: poolPda,
      userVault,
      priceFeed,
      userStableAccount,
      mintAuthority: mintAuthorityPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(ix);
  await (program.provider as anchor.AnchorProvider).sendAndConfirm(tx, [user]);
}

async function sendRepay(
  program: anchor.Program,
  user: Keypair,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  repayAmount: bigint
): Promise<void> {
  const [globalStatePda] = PublicKey.findProgramAddressSync([SEED_GLOBAL], program.programId);
  const [poolRegistryPda] = PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    program.programId
  );
  const poolPda = findPoolPda(program.programId, collateralMint);
  const userVault = findVaultPda(program.programId, user.publicKey, poolPda);
  const userStableAccount = getAssociatedTokenAddressSync(stablecoinMint, user.publicKey);

  const ix = await program.methods
    .repay(new anchor.BN(repayAmount.toString()))
    .accountsPartial({
      user: user.publicKey,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      collateralMint,
      stablecoinMint,
      pool: poolPda,
      userVault,
      userStableAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
    .add(ix);

  await (program.provider as anchor.AnchorProvider).sendAndConfirm(tx, [user]);
}

async function sendWithdraw(
  program: anchor.Program,
  user: Keypair,
  collateralMint: PublicKey,
  sharesToBurn: bigint
): Promise<void> {
  const [globalStatePda] = PublicKey.findProgramAddressSync([SEED_GLOBAL], program.programId);
  const [poolRegistryPda] = PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    program.programId
  );
  const poolPda = findPoolPda(program.programId, collateralMint);
  const userVault = findVaultPda(program.programId, user.publicKey, poolPda);
  const userCollateralAccount = getAssociatedTokenAddressSync(collateralMint, user.publicKey);
  const poolCollateralAccount = getAssociatedTokenAddressSync(collateralMint, poolPda, true);

  const ix = await program.methods
    .withdraw(new anchor.BN(sharesToBurn.toString()))
    .accountsPartial({
      user: user.publicKey,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      userCollateralAccount,
      poolCollateralAccount,
      pool: poolPda,
      userVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }))
    .add(ix);

  await (program.provider as anchor.AnchorProvider).sendAndConfirm(tx, [user]);
}

async function setMockPrice(
  program: anchor.Program,
  admin: Keypair,
  globalState: PublicKey,
  mint: PublicKey,
  mockPriceFeed: PublicKey,
  usdPrice: number
): Promise<void> {
  const price = BigInt(Math.round(usdPrice * 100_000_000));
  const confidence = BigInt(Math.max(1, Math.round(usdPrice * 0.01 * 100_000_000)));

  const tx = await (program.methods
    .setMockPrice(new anchor.BN(price.toString()), new anchor.BN(confidence.toString())) as any)
    .accounts({
      admin: admin.publicKey,
      globalState,
      collateralMint: mint,
      mockPriceFeed,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`   Price set to $${usdPrice.toFixed(2)} (${tx.slice(0, 10)}...)`);
}

async function sendLiquidation(
  program: anchor.Program,
  liquidator: Keypair,
  vaultOwner: PublicKey,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  priceFeed: PublicKey,
  debtToRepay: bigint
): Promise<void> {
  const [globalStatePda] = PublicKey.findProgramAddressSync([SEED_GLOBAL], program.programId);
  const [poolRegistryPda] = PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    program.programId
  );
  const poolPda = findPoolPda(program.programId, collateralMint);
  const userVault = findVaultPda(program.programId, vaultOwner, poolPda);

  const liquidatorStableAccount = getAssociatedTokenAddressSync(stablecoinMint, liquidator.publicKey);
  const liquidatorCollateralAccount = getAssociatedTokenAddressSync(collateralMint, liquidator.publicKey);
  const poolCollateralAccount = getAssociatedTokenAddressSync(collateralMint, poolPda, true);

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 })
  );

  const liqCollateralAtaInfo = await program.provider.connection.getAccountInfo(liquidatorCollateralAccount);
  if (!liqCollateralAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        liquidator.publicKey,
        liquidatorCollateralAccount,
        liquidator.publicKey,
        collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  const ix = await program.methods
    .liquidateVault(new anchor.BN(debtToRepay.toString()))
    .accountsPartial({
      liquidator: liquidator.publicKey,
      globalState: globalStatePda,
      poolRegistry: poolRegistryPda,
      collateralMint,
      stablecoinMint,
      pool: poolPda,
      userVault,
      priceFeed,
      liquidatorStableAccount,
      liquidatorCollateralAccount,
      poolCollateralAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(ix);
  await (program.provider as anchor.AnchorProvider).sendAndConfirm(tx, [liquidator]);
}

async function main() {
  const opts = parseCli();
  const addresses = loadAddresses();
  const admin = loadAdminKeypair();

  const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync("./anchor/target/idl/anchor.json", "utf8"));
  const program = new anchor.Program(idl, provider);

  const programId = new PublicKey(addresses.PROGRAM_ID);
  if (!program.programId.equals(programId)) {
    throw new Error(`IDL program id ${program.programId.toBase58()} != protocol-addresses ${programId.toBase58()}`);
  }

  const globalState = await (program.account as any).globalState.fetch(
    new PublicKey(addresses.GLOBAL_STATE)
  );
  const stablecoinMint = globalState.stablecoinMint as PublicKey;
  const stableMintInfo = await getMint(connection, stablecoinMint);
  const stableDecimals = stableMintInfo.decimals;

  const targetSymbols = opts.symbols;
  const pools: PoolSeedConfig[] = [];
  for (const symbol of targetSymbols) {
    const mintRaw = addresses[`${symbol}_MINT`];
    const pfRaw = addresses[`${symbol}_PRICE_FEED`];
    if (!mintRaw || !pfRaw) {
      continue;
    }
    const mint = new PublicKey(mintRaw);
    const priceFeed = new PublicKey(pfRaw);
    const mintInfo = await getMint(connection, mint);
    const poolPda = findPoolPda(program.programId, mint);
    const poolState: any = await (program.account as any).collateralPool.fetch(poolPda);
    pools.push({
      symbol,
      mint,
      priceFeed,
      basePrice: DEFAULT_BASE_PRICES[symbol],
      decimals: mintInfo.decimals,
      collateralFactorBps: Number(poolState.collateralFactor.toString()),
      liquidationFactorBps: Number(poolState.liquidationFactor.toString()),
    });
  }

  if (pools.length === 0) {
    throw new Error("No pools found in protocol-addresses.json for SOL/wBTC/wETH/wSUI");
  }

  console.log("\n=== WUSD Activity Seeder ===");
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`Program: ${program.programId.toBase58()}`);
  console.log(`Pools: ${pools.map((p) => p.symbol).join(", ")}`);
  console.log(`Users: ${opts.users}`);
  console.log(`Target liquidations: ${opts.liquidations}`);
  console.log(`Risk mode: ${opts.risky ? "high" : "normal"}`);

  // Restore baseline prices before seeding so borrow sizing matches oracle values.
  for (const pool of pools) {
    await safeRun(`reset ${pool.symbol} price`, () =>
      setMockPrice(
        program,
        admin,
        new PublicKey(addresses.GLOBAL_STATE),
        pool.mint,
        pool.priceFeed,
        pool.basePrice
      )
    );
  }

  // One dedicated liquidator account with fresh WUSD balance.
  const liquidator = Keypair.generate();
  await safeRun("fund liquidator", () => ensureUserFunding(connection, admin, liquidator, 0.6));

  const liquidatorPool = pools.find((p) => p.symbol === "SOL") || pools[0];
  const liquidatorDepositUi = liquidatorPool.symbol === "SOL" ? 0.12 : 0.02;
  await safeRun("seed liquidator collateral", () =>
    seedCollateralToUser(
      connection,
      admin,
      liquidator.publicKey,
      liquidatorPool.mint,
      liquidatorDepositUi,
      liquidatorPool.decimals
    )
  );

  await safeRun("liquidator deposit", () =>
    sendDeposit(
      program,
      liquidator,
      liquidatorPool.mint,
      toUnits(liquidatorDepositUi, liquidatorPool.decimals)
    )
  );

  const liquidatorCollateralValueUsd = liquidatorDepositUi * liquidatorPool.basePrice;
  const liquidatorMaxBorrowUsd =
    (liquidatorCollateralValueUsd * 10_000) / liquidatorPool.collateralFactorBps;
  const liquidatorMintUsd = Math.max(1.5, liquidatorMaxBorrowUsd * 0.28);
  await safeRun("liquidator mint WUSD", () =>
    sendMintStable(
      program,
      liquidator,
      liquidatorPool.mint,
      stablecoinMint,
      liquidatorPool.priceFeed,
      toUnits(liquidatorMintUsd, stableDecimals)
    )
  );

  const positions: Position[] = [];
  const stats: SeedStats = {
    usersSeeded: 0,
    depositsOk: 0,
    mintsOk: 0,
    repaysOk: 0,
    liquidationsOk: 0,
  };

  for (let i = 0; i < opts.users; i += 1) {
    const adminLamports = await connection.getBalance(admin.publicKey, "confirmed");
    if (adminLamports < Math.floor(0.12 * LAMPORTS_PER_SOL)) {
      console.log("   Admin SOL too low to keep seeding more users. Stopping early.");
      break;
    }

    const user = Keypair.generate();
    const pool = pools[i % pools.length];

    const depositUi =
      pool.symbol === "wBTC"
        ? rand(0.02, 0.09)
        : pool.symbol === "wETH"
        ? rand(0.7, 4.5)
        : pool.symbol === "wSUI"
        ? rand(1.2, 9)
        : rand(0.05, 0.2);

    const requiredSol = pool.symbol === "SOL" ? depositUi + 0.12 : 0.06;
    const funded = await safeRun("fund user", () =>
      ensureUserFunding(connection, admin, user, requiredSol)
    );
    if (funded === null) continue;

    const seeded = await safeRun("seed user collateral", () =>
      seedCollateralToUser(connection, admin, user.publicKey, pool.mint, depositUi, pool.decimals)
    );
    if (seeded === null) continue;

    const depositUnits = toUnits(depositUi, pool.decimals);
    const deposited = await safeRun("user deposit", () =>
      sendDeposit(program, user, pool.mint, depositUnits)
    );
    if (deposited === null) continue;
    stats.depositsOk += 1;

    const collateralValueUsd = depositUi * pool.basePrice;
    const maxBorrowUsd = (collateralValueUsd * 10_000) / pool.collateralFactorBps;
    const borrowRatio = opts.risky ? rand(0.83, 0.9) : rand(0.5, 0.75);
    const mintUsd = maxBorrowUsd * borrowRatio;
    const mintUnits = toUnits(mintUsd, stableDecimals);

    const minted = await safeRun("user mint WUSD", () =>
      sendMintStable(program, user, pool.mint, stablecoinMint, pool.priceFeed, mintUnits)
    );
    if (minted === null) continue;
    stats.mintsOk += 1;
    stats.usersSeeded += 1;

    if (Math.random() < 0.35) {
      const repayUnits = toUnits(mintUsd * rand(0.08, 0.28), stableDecimals);
      const repaid = await safeRun("user repay", () =>
        sendRepay(program, user, pool.mint, stablecoinMint, repayUnits)
      );
      if (repaid !== null) stats.repaysOk += 1;
    }

    positions.push({
      user,
      symbol: pool.symbol,
      mint: pool.mint,
      priceFeed: pool.priceFeed,
    });

    console.log(
      `[${i + 1}/${opts.users}] ${pool.symbol} user ${user.publicKey.toBase58().slice(0, 8)}... ` +
        `deposit ${depositUi.toFixed(4)} / mint $${mintUsd.toFixed(2)}`
    );
  }

  // Force a subset into liquidation by dropping price sharply and liquidating part of debt.
  const shuffled = [...positions].sort(() => Math.random() - 0.5);
  const victims = shuffled.slice(0, Math.min(opts.liquidations, shuffled.length));

  console.log(`\nRunning ${victims.length} liquidations...`);

  const liqStableAta = getAssociatedTokenAddressSync(stablecoinMint, liquidator.publicKey);
  let liqStableBalance = 0n;
  try {
    liqStableBalance = BigInt((await getAccount(connection, liqStableAta)).amount.toString());
  } catch {
    liqStableBalance = 0n;
  }

  if (liqStableBalance <= 0n) {
    console.log("   Liquidator has no WUSD, skipping liquidation pass.");
  }

  for (const victim of victims) {
    if (liqStableBalance <= 0n) {
      break;
    }

    const pool = pools.find((p) => p.symbol === victim.symbol)!;
    const poolPda = findPoolPda(program.programId, pool.mint);
    const userVault = findVaultPda(program.programId, victim.user.publicKey, poolPda);

    const loweredPrice = pool.basePrice * rand(0.08, 0.2);
    await setMockPrice(
      program,
      admin,
      new PublicKey(addresses.GLOBAL_STATE),
      pool.mint,
      pool.priceFeed,
      loweredPrice
    );

    const vault: any = await (program.account as any).userVault.fetch(userVault);
    const debt = BigInt(vault.debtAmount.toString());
    if (debt <= 0n) {
      console.log(`   Skip ${victim.user.publicKey.toBase58().slice(0, 8)}... (no debt)`);
      continue;
    }

    const repayTarget = debt / 3n;
    const repayAmount = repayTarget > liqStableBalance ? liqStableBalance / 2n : repayTarget;

    if (repayAmount <= 0n) {
      console.log("   Liquidator out of WUSD, stopping liquidations.");
      break;
    }

    const liquidated = await safeRun("liquidation tx", () =>
      sendLiquidation(
        program,
        liquidator,
        victim.user.publicKey,
        pool.mint,
        stablecoinMint,
        pool.priceFeed,
        repayAmount
      )
    );
    if (liquidated === null) continue;
    stats.liquidationsOk += 1;

    liqStableBalance -= repayAmount;

    console.log(
      `   Liquidated ${victim.symbol} vault ${victim.user.publicKey.toBase58().slice(0, 8)}... ` +
        `for ${fromUnits(repayAmount, stableDecimals).toFixed(2)} WUSD`
    );
  }

  console.log("\n=== Seeder Summary ===");
  console.log(`Users with position: ${stats.usersSeeded}`);
  console.log(`Successful deposits: ${stats.depositsOk}`);
  console.log(`Successful mints: ${stats.mintsOk}`);
  console.log(`Successful repays: ${stats.repaysOk}`);
  console.log(`Successful liquidations: ${stats.liquidationsOk}`);

  console.log("\nDone. Vaults now have real deposits, debt, repayment activity, and liquidation attempts.");
}

main().catch((err) => {
  console.error("Seeder failed:", err);
  process.exit(1);
});
