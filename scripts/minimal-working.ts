// scripts/minimal-working.ts
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';

async function testValidatorOnly() {
  console.log('=== MINIMAL VALIDATOR TEST ===\n');
  
  // Setup
  const connection = new Connection('http://localhost:8899', 'confirmed');
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')))
  );
  
  console.log('1️⃣ Checking balance...');
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('   Balance:', balance / 1e9, 'SOL');
  
  if (balance === 0) {
    console.log('   ❗ Zero balance! Getting airdrop...');
    try {
      const sig = await connection.requestAirdrop(wallet.publicKey, 1e9);
      await connection.confirmTransaction(sig);
      console.log('   ✅ Airdrop received');
    } catch (e: any) {
      console.log('   ❌ Airdrop failed:', e.message);
    }
  }
  
  console.log('\n2️⃣ Testing simulation...');
  const testIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1000,
  });
  
  const blockhash = await connection.getLatestBlockhash();
  const testTx = new Transaction({
    recentBlockhash: blockhash.blockhash,
    feePayer: wallet.publicKey,
  }).add(testIx);
  
  const sim = await connection.simulateTransaction(testTx);
  console.log('   Simulation success:', !sim.value.err);
  console.log('   CU used:', sim.value.unitsConsumed);
  
  if (sim.value.err) {
    console.log('   ❌ Simulation error:', sim.value.err);
    console.log('\n⚠️  YOUR VALIDATOR IS BROKEN!');
    console.log('Run these commands:');
    console.log('   pkill -f solana-test-validator');
    console.log('   solana-test-validator --reset --log &');
    console.log('   sleep 3');
    console.log('   solana airdrop 10');
    return;
  }
  
  console.log('\n3️⃣ Testing real transaction...');
  try {
    testTx.sign(wallet);
    const sig = await connection.sendRawTransaction(testTx.serialize());
    console.log('   ✅ Transaction sent:', sig);
    
    const conf = await connection.confirmTransaction({
      signature: sig,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    });
    
    if (conf.value.err) {
      console.log('   ❌ Confirmation failed:', conf.value.err);
    } else {
      console.log('   ✅ Transaction confirmed!');
    }
  } catch (e: any) {
    console.log('   ❌ Transaction failed:', e.message);
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

testValidatorOnly().catch(console.error);