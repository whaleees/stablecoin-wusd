import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';

/**
 * Creates a mock price feed account for local testing
 * Writes SOL/USD = $100 at the expected offset
 */

const PRICE_ACCOUNT_SIZE = 128; // Minimal size for our mock

async function main() {
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

  // Load payer wallet
  const payerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')
      )
    )
  );

  // Load or create price feed keypair
  let pythKeypair: Keypair;
  const keypairPath = './mock-pyth-sol-usd.json';
  
  if (fs.existsSync(keypairPath)) {
    pythKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
    );
    console.log('Using existing keypair:', pythKeypair.publicKey.toBase58());
    
    // Check if account already exists
    const existing = await connection.getAccountInfo(pythKeypair.publicKey);
    if (existing) {
      console.log('✅ Price feed account already exists!');
      console.log('   Address:', pythKeypair.publicKey.toBase58());
      return;
    }
  } else {
    pythKeypair = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(pythKeypair.secretKey)));
    console.log('Created new keypair:', pythKeypair.publicKey.toBase58());
  }

  // Create price data buffer
  // Price at offset 16: $100.00 with 8 decimals = 10_000_000_000
  // Confidence at offset 24: $0.10 = 10_000_000
  const priceData = Buffer.alloc(PRICE_ACCOUNT_SIZE);
  const price = BigInt(10_000_000_000); // $100.00
  const confidence = BigInt(10_000_000); // $0.10
  
  priceData.writeBigInt64LE(price, 16);
  priceData.writeBigUInt64LE(confidence, 24);

  // Calculate rent
  const lamports = await connection.getMinimumBalanceForRentExemption(PRICE_ACCOUNT_SIZE);

  // Create account with our data
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payerKeypair.publicKey,
      newAccountPubkey: pythKeypair.publicKey,
      lamports,
      space: PRICE_ACCOUNT_SIZE,
      programId: SystemProgram.programId, // System program owned for simplicity
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payerKeypair, pythKeypair]);
  console.log('✅ Mock price feed created!');
  console.log('   TX:', sig);
  console.log('   Address:', pythKeypair.publicKey.toBase58());
  console.log('   Price: $100.00');
  console.log('   Confidence: $0.10');
  console.log('\n📝 Add this to frontend/.env.local:');
  console.log(`   NEXT_PUBLIC_PRICE_FEED=${pythKeypair.publicKey.toBase58()}`);
}

main().catch(console.error);
