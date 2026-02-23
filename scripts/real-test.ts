// scripts/real-test.ts
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import * as fs from 'fs';
import idl from '../anchor/target/idl/anchor.json';

const PROGRAM_ID = new PublicKey('BkVyDX6zTMc2CXZRaH2vHBbVkTBVCyij1i6CXMoaPbsN');

async function realTest() {
  console.log('🚀 Starting real test...\n');
  
  // 1. Setup connection
  const connection = new Connection('http://localhost:8899', 'confirmed');
  
  // 2. Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(
      process.env.HOME + '/.config/solana/id.json',
      'utf-8'
    )))
  );
  console.log('👛 Wallet:', walletKeypair.publicKey.toString());
  
  // 3. Check balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log('💰 Balance:', balance / anchor.web3.LAMPORTS_PER_SOL, 'SOL');
  
  // 4. Test connection with a REAL transaction (not simulation)
  console.log('\n🧪 Testing validator with real transaction...');
  const testAccount = Keypair.generate();
  
  const createIx = SystemProgram.createAccount({
    fromPubkey: walletKeypair.publicKey,
    newAccountPubkey: testAccount.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(0),
    space: 0,
    programId: SystemProgram.programId,
  });
  
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  
  const testTx = new anchor.web3.Transaction({
    recentBlockhash: blockhash,
    feePayer: walletKeypair.publicKey,
  }).add(createIx);
  
  testTx.sign(walletKeypair, testAccount);
  
  try {
    const sig = await connection.sendRawTransaction(testTx.serialize());
    console.log('✅ Test transaction sent:', sig);
    
    // Wait for confirmation
    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    console.log('✅ Test transaction confirmed!\n');
  } catch (error: any) {
    console.log('❌ Validator test failed:', error.message);
    console.log('This means your validator is broken. Try:');
    console.log('   solana-test-validator --reset --quiet &');
    console.log('   sleep 3 && solana airdrop 10');
    return;
  }
  
  // 5. Now test your program
  console.log('🎯 Testing your program...');
  
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { commitment: 'confirmed' }
  );
  
  const program = new anchor.Program(idl as anchor.Idl, provider);
  
  // Use a UNIQUE seed to avoid conflicts
  const uniqueSeed = Buffer.from(`test-${Date.now()}`);
  const [testPDA] = PublicKey.findProgramAddressSync([uniqueSeed], PROGRAM_ID);
  
  console.log('📦 PDA:', testPDA.toString());
  console.log('   Seed:', uniqueSeed.toString('hex'));
  
  // Check if PDA exists (should not)
  const pdaInfo = await connection.getAccountInfo(testPDA);
  if (pdaInfo) {
    console.log('⚠️  PDA already exists! Using different seed...');
    // Try another seed
    const anotherSeed = Buffer.from(`test-${Date.now()}-${Math.random()}`);
    const [anotherPDA] = PublicKey.findProgramAddressSync([anotherSeed], PROGRAM_ID);
    return await testWithPDA(program, anotherPDA, walletKeypair.publicKey);
  }
  
  await testWithPDA(program, testPDA, walletKeypair.publicKey);
}

async function testWithPDA(program: anchor.Program, pda: PublicKey, payer: PublicKey) {
  console.log('\n🔄 Calling testMinimal...');
  
  try {
    // Build transaction
    const tx = await program.methods
      .testMinimal()
      .accounts({
        payer,
        state: pda,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    
    // Add compute budget
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
      units: 400_000 
    });
    
    const fullTx = new anchor.web3.Transaction()
      .add(modifyComputeUnits)
      .add(tx);
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await program.provider.connection.getLatestBlockhash();
    fullTx.recentBlockhash = blockhash;
    fullTx.feePayer = payer;
    
    // SIMULATE first (using connection.simulateTransaction)
    console.log('📊 Simulating...');
    const simulation = await program.provider.connection.simulateTransaction(fullTx);
    
    console.log('✅ Simulation result:', !simulation.value.err ? 'SUCCESS' : 'FAILED');
    console.log('📈 Compute units:', simulation.value.unitsConsumed);
    if (simulation.value.logs) {
      console.log('📝 Logs (first 5):');
      simulation.value.logs.slice(0, 5).forEach((log, i) => console.log(`   ${i}: ${log}`));
    }
    
    if (simulation.value.err) {
      console.log('❌ Simulation failed, not sending real transaction');
      return;
    }
    
    // If simulation works, send for real
    console.log('\n🚀 Sending real transaction...');
    
    const signature = await program.provider.sendAndConfirm(fullTx);
    
    console.log('🎉 SUCCESS! Signature:', signature);
    
    // Verify the PDA was created
    await new Promise(resolve => setTimeout(resolve, 2000));
    const created = await program.provider.connection.getAccountInfo(pda);
    console.log('📦 Account created:', !!created);
    if (created) {
      console.log('   Owner:', created.owner.toString());
      console.log('   Data length:', created.data.length);
      
      // Try to fetch as your account type
      try {
        const accountData = await program.account.testState.fetch(pda);
        console.log('   Account data:', accountData);
      } catch (e) {
        console.log('   Could not decode account data');
      }
    }
    
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    if (error.logs) {
      console.log('Logs:', error.logs);
    }
    if (error.error && error.error.errorCode) {
      console.log('Error code:', error.error.errorCode);
    }
  }
}

realTest().catch(console.error);