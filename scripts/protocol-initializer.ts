import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createMint,
  setAuthority,
  AuthorityType,
  createInitializeAccountInstruction,
} from '@solana/spl-token';
import * as fs from 'fs';
import idl from '../anchor/target/idl/anchor.json';

const PROGRAM_ID = new PublicKey('DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz');

// Protocol parameters
const DEBT_CEILING = 1_000_000_000_000;
const STABILITY_FEE = 500;
const LIQUIDATION_PENALTY = 1000;
const COLLATERAL_FACTOR = 15000;
const LIQUIDATION_FACTOR = 12000;

async function initializeProtocol() {
  const connection = new Connection('http://localhost:8899', 'confirmed');
  
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(
          process.env.HOME + '/.config/solana/id.json',
          'utf-8'
        )
      )
    )
  );

  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  console.log('🚀 Starting WUSD Protocol Initialization...\n');
  console.log('Wallet:', wallet.publicKey.toBase58());
  console.log('Program ID:', PROGRAM_ID.toBase58(), '\n');

  const program = new Program(idl as anchor.Idl, provider);

  // Step 1: Create WUSD Stablecoin Mint
  console.log('1️⃣  Creating WUSD stablecoin mint...');
  const wusdMint = await createMint(
    connection,
    walletKeypair,
    walletKeypair.publicKey,
    null,
    6,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log('   ✅ WUSD Mint:', wusdMint.toBase58(), '\n');

  // Step 2: Create Governance Token Mint
  console.log('2️⃣  Creating governance token mint...');
  const govMint = await createMint(
    connection,
    walletKeypair,
    walletKeypair.publicKey,
    null,
    9,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log('   ✅ Governance Mint:', govMint.toBase58(), '\n');

  // Step 3: Calculate PDAs
  console.log('3️⃣  Calculating PDAs...');
  const [globalStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    PROGRAM_ID
  );
  const [poolRegistryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_registry')],
    PROGRAM_ID
  );
  const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint_authority')],
    PROGRAM_ID
  );
  console.log('   Global State PDA:', globalStatePDA.toBase58());
  console.log('   Pool Registry PDA:', poolRegistryPDA.toBase58());
  console.log('   Mint Authority PDA:', mintAuthorityPDA.toBase58(), '\n');

  // Step 4: Set WUSD mint authority to program PDA
  console.log('4️⃣  Setting WUSD mint authority to program...');
  await setAuthority(
    connection,
    walletKeypair,
    wusdMint,
    walletKeypair.publicKey,
    AuthorityType.MintTokens,
    mintAuthorityPDA,
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );
  console.log('   ✅ Mint authority transferred to PDA\n');

  // Step 5: Initialize Global State
  console.log('5️⃣  Initializing global state...');
  try {
    const initGlobalTx = await program.methods
      .initializeGlobalState(
        new anchor.BN(DEBT_CEILING),
        new anchor.BN(STABILITY_FEE),
        new anchor.BN(LIQUIDATION_PENALTY)
      )
      .accounts({
        admin: wallet.publicKey,
        globalState: globalStatePDA,
        stablecoinMint: wusdMint,
        governanceTokenMint: govMint,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
      units: 1_400_000 
    });

    const tx1 = new Transaction().add(modifyComputeUnits).add(initGlobalTx);
    
    // Add recent blockhash for simulation
    tx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx1.feePayer = wallet.publicKey;
    
    // Get simulation first to see actual CU usage
    console.log('   🔍 Running simulation...');
    const simulation = await connection.simulateTransaction(tx1);
    
    console.log('\n   📊 === COMPUTE UNIT ANALYSIS ===');
    console.log('   📊 Units Consumed:', simulation.value.unitsConsumed);
    console.log('   📊 Units Limit:', 1_400_000);
    console.log('   📊 Units Remaining:', 1_400_000 - (simulation.value.unitsConsumed || 0));
    console.log('   📊 Success:', !simulation.value.err);
    console.log('   📊 ================================\n');
    
    if (simulation.value.logs) {
      console.log('   📋 Simulation Logs:');
      simulation.value.logs.forEach((log, i) => {
        console.log(`      ${i + 1}. ${log}`);
      });
      console.log();
    }
    
    if (simulation.value.err) {
      console.log('   ❌ Simulation Error:', simulation.value.err);
      throw new Error('Simulation failed - see logs above');
    }

    console.log('   ✅ Simulation passed! Sending transaction...');
    const sig1 = await provider.sendAndConfirm(tx1);
    console.log('   ✅ Global state initialized');
    console.log('   Transaction:', sig1, '\n');
  } catch (err) {
    console.error('\n   ❌ Full error:', err);
    
    try {
      const globalAccount = await connection.getAccountInfo(globalStatePDA);
      if (globalAccount) {
        console.log('   ℹ️  Global state already initialized, continuing...\n');
      } else {
        console.log('   ❌ Initialization failed and global state does not exist.');
        console.log('   Please check the error above and try again.\n');
        process.exit(1);
      }
    } catch (checkErr) {
      console.log('   ❌ Failed to verify global state status\n');
      process.exit(1);
    }
  }

  // Step 6: Initialize Pool Registry
  console.log('6️⃣  Initializing pool registry...');
  try {
    const initPoolRegTx = await program.methods
      .initializePoolRegistry()
      .accounts({
        admin: wallet.publicKey,
        poolRegistry: poolRegistryPDA,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
      units: 800_000 
    });

    const tx2 = new Transaction().add(modifyComputeUnits).add(initPoolRegTx);
    
    // Simulate this one too
    tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx2.feePayer = wallet.publicKey;
    
    const simulation2 = await connection.simulateTransaction(tx2);
    console.log('   📊 Pool Registry CU Consumed:', simulation2.value.unitsConsumed);
    
    const sig2 = await provider.sendAndConfirm(tx2);
    console.log('   ✅ Pool registry initialized');
    console.log('   Transaction:', sig2, '\n');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log('   ⚠️  Pool registry initialization error:', errorMsg, '\n');
    
    try {
      const registryAccount = await connection.getAccountInfo(poolRegistryPDA);
      if (registryAccount) {
        console.log('   ℹ️  Pool registry already initialized, continuing...\n');
      } else {
        console.log('   ❌ Initialization failed and pool registry does not exist.');
        console.log('   Please check the error above and try again.\n');
        process.exit(1);
      }
    } catch (checkErr) {
      console.log('   ❌ Failed to verify pool registry status\n');
      process.exit(1);
    }
  }

  // Step 7: Initialize SOL Collateral Pool
  console.log('7️⃣  Initializing SOL collateral pool...');
  
  const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  
  const [poolPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('collateral_pool'), SOL_MINT.toBuffer()],
    PROGRAM_ID
  );

  const interestRateModel = Keypair.generate().publicKey;

  try {
    const tx = await program.methods
      .initializePool(
        new anchor.BN(COLLATERAL_FACTOR),
        new anchor.BN(LIQUIDATION_FACTOR),
        interestRateModel
      )
      .accounts({
        admin: wallet.publicKey,
        globalState: globalStatePDA,
        poolRegistry: poolRegistryPDA,
        collateralMint: SOL_MINT,
        pool: poolPDA,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 500_000,
        }),
      ])
      .rpc();
    console.log('   ✅ SOL pool initialized');
    console.log('   Pool PDA:', poolPDA.toBase58());
    console.log('   Transaction:', tx, '\n');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log('   ⚠️  Pool initialization error:', errorMsg, '\n');
    
    try {
      const poolAccount = await connection.getAccountInfo(poolPDA);
      if (poolAccount) {
        console.log('   ℹ️  Pool already initialized, continuing...\n');
      } else {
        console.log('   ❌ Pool initialization failed. Error above.\n');
      }
    } catch (checkErr) {
      console.log('   ❌ Failed to verify pool status\n');
    }
  }

  // Step 8: Create Pool's Collateral Token Account
  console.log('8️⃣  Creating pool collateral vault...');
  
  const poolCollateralKeypair = Keypair.generate();
  
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: poolCollateralKeypair.publicKey,
    space: 165,
    lamports: await connection.getMinimumBalanceForRentExemption(165),
    programId: TOKEN_PROGRAM_ID,
  });

  const initAccountIx = createInitializeAccountInstruction(
    poolCollateralKeypair.publicKey,
    SOL_MINT,
    poolPDA,
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(createAccountIx, initAccountIx);
  const sig = await provider.sendAndConfirm(tx, [poolCollateralKeypair]);
  
  console.log('   ✅ Pool Collateral Account:', poolCollateralKeypair.publicKey.toBase58());
  console.log('   Transaction:', sig, '\n');

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ WUSD PROTOCOL INITIALIZED SUCCESSFULLY!\n');
  console.log('📋 Important Addresses (save these!):\n');
  console.log('Program ID:', PROGRAM_ID.toBase58());
  console.log('WUSD Mint:', wusdMint.toBase58());
  console.log('Governance Mint:', govMint.toBase58());
  console.log('Global State:', globalStatePDA.toBase58());
  console.log('Pool Registry:', poolRegistryPDA.toBase58());
  console.log('Mint Authority PDA:', mintAuthorityPDA.toBase58());
  console.log('\nSOL Pool:');
  console.log('  Pool PDA:', poolPDA.toBase58());
  console.log('  Pool Collateral Vault:', poolCollateralKeypair.publicKey.toBase58());
  console.log('  Collateral Mint (SOL):', SOL_MINT.toBase58());
  console.log('\nProtocol Parameters:');
  console.log('  Debt Ceiling:', DEBT_CEILING / 1_000_000, 'WUSD');
  console.log('  Stability Fee:', STABILITY_FEE / 100, '%');
  console.log('  Liquidation Penalty:', LIQUIDATION_PENALTY / 100, '%');
  console.log('  Collateral Factor:', COLLATERAL_FACTOR / 100, '%');
  console.log('  Liquidation Factor:', LIQUIDATION_FACTOR / 100, '%');
  console.log('═══════════════════════════════════════════════════════\n');

  // Save addresses to JSON file
  const addresses = {
    programId: PROGRAM_ID.toBase58(),
    wusdMint: wusdMint.toBase58(),
    governanceMint: govMint.toBase58(),
    globalState: globalStatePDA.toBase58(),
    poolRegistry: poolRegistryPDA.toBase58(),
    mintAuthority: mintAuthorityPDA.toBase58(),
    solPool: {
      poolPda: poolPDA.toBase58(),
      collateralVault: poolCollateralKeypair.publicKey.toBase58(),
      collateralMint: SOL_MINT.toBase58(),
    },
  };

  fs.writeFileSync(
    'protocol-addresses.json',
    JSON.stringify(addresses, null, 2)
  );
  console.log('💾 Addresses saved to: protocol-addresses.json\n');
}

initializeProtocol()
  .then(() => {
    console.log('🎉 Setup complete! Ready to build frontend.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });