import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';

/**
 * Creates a mock Pyth price feed account for local testing
 * This simulates the Pyth oracle price feed structure
 */

const PRICE_ACCOUNT_SIZE = 3312; // Pyth price account size

async function createMockPythAccount() {
  // Connect to localhost
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Load your wallet (default Solana CLI keypair)
  const payerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(
          process.env.HOME + '/.config/solana/id.json',
          'utf-8'
        )
      )
    )
  );

  console.log('Payer:', payerKeypair.publicKey.toBase58());

  // Create keypair for mock Pyth account
  const pythKeypair = Keypair.generate();
  
  console.log('\n🔑 Mock Pyth Price Feed Account:', pythKeypair.publicKey.toBase58());
  console.log('   Save this address for your frontend!\n');

  // Create the account
  const lamports = await connection.getMinimumBalanceForRentExemption(
    PRICE_ACCOUNT_SIZE
  );

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payerKeypair.publicKey,
    newAccountPubkey: pythKeypair.publicKey,
    lamports,
    space: PRICE_ACCOUNT_SIZE,
    programId: payerKeypair.publicKey, // Owner is our wallet for testing
  });

  const tx = new Transaction().add(createAccountIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [
    payerKeypair,
    pythKeypair,
  ]);

  console.log('✅ Mock Pyth account created:', sig);

  // Write mock price data (SOL/USD = $100.00)
  // Pyth price format: price at offset 16 (8 bytes, i64)
  const accountInfo = await connection.getAccountInfo(pythKeypair.publicKey);
  
  if (!accountInfo) {
    throw new Error('Failed to create account');
  }

  const priceData = Buffer.alloc(PRICE_ACCOUNT_SIZE);
  
  // Write price at offset 16 (SOL price = $100.00)
  // Pyth uses 8 decimal places, so $100 = 100_00000000
  const price = BigInt(100_00000000); // $100.00 with 8 decimals
  priceData.writeBigInt64LE(price, 16);
  
  // Write confidence at offset 24 (let's use $0.10)
  const confidence = BigInt(10000000); // $0.10 with 8 decimals
  priceData.writeBigUInt64LE(confidence, 24);

  // Write the data to the account (in real setup, you'd need a program to do this)
  // For local testing, we're simplifying this
  
  console.log('📊 Mock price data prepared:');
  console.log('   Price: $100.00');
  console.log('   Confidence: $0.10');
  
  // Save the keypair for future use
  fs.writeFileSync(
    'mock-pyth-sol-usd.json',
    JSON.stringify(Array.from(pythKeypair.secretKey))
  );
  
  console.log('\n💾 Keypair saved to: mock-pyth-sol-usd.json');
  console.log('\n⚠️  NOTE: For the price data to work with your program,');
  console.log('   you need to write the buffer to the account using a program.');
  console.log('   Alternatively, use the hardcoded approach in the setup script.\n');

  return pythKeypair.publicKey;
}

createMockPythAccount()
  .then((pubkey) => {
    console.log('✅ Setup complete!');
    console.log('\nMock Pyth Address:', pubkey.toBase58());
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });