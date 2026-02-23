// diag.ts
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';

async function diagnose() {
  const connection = new Connection('http://localhost:8899', 'confirmed');
  
  // Check connection
  const version = await connection.getVersion();
  console.log('✅ Solana Version:', version['solana-core']);
  
  // Check balance
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')))
  );
  
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log('💰 Balance:', balance / 1e9, 'SOL');
  
  // Check program
  const PROGRAM_ID = new PublicKey('BkVyDX6zTMc2CXZRaH2vHBbVkTBVCyij1i6CXMoaPbsN');
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  console.log('📦 Program exists:', !!programInfo);
  if (programInfo) {
    console.log('   Executable:', programInfo.executable);
    console.log('   Data length:', programInfo.data.length);
  }
  
  // Check PDA
  const [testPDA] = PublicKey.findProgramAddressSync([Buffer.from('test')], PROGRAM_ID);
  console.log('🔑 PDA:', testPDA.toString());
  const pdaInfo = await connection.getAccountInfo(testPDA);
  console.log('   PDA exists:', !!pdaInfo);
  
  // Try a simple system transfer to test compute
  console.log('\n🧪 Testing compute with simple transfer...');
  const transferTx = anchor.web3.SystemProgram.transfer({
    fromPubkey: walletKeypair.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1000,
  });
  
  const blockhash = await connection.getLatestBlockhash();
  const simpleTx = new anchor.web3.Transaction({
    ...blockhash,
    feePayer: walletKeypair.publicKey,
  }).add(transferTx);
  
  const simulation = await connection.simulateTransaction(simpleTx);
  console.log('   Transfer CU:', simulation.value.unitsConsumed);
  console.log('   Success:', !simulation.value.err);
}

diagnose().catch(console.error);