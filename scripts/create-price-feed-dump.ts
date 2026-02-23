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
 * Creates a mock price feed by using the BPF Upgradeable Loader buffer
 * This allows us to write arbitrary data to an account
 */

const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

async function main() {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Load payer wallet
  const payerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')
      )
    )
  );

  // Load or generate price feed keypair
  let pythKeypair: Keypair;
  const keypairPath = './mock-pyth-sol-usd.json';
  
  if (fs.existsSync(keypairPath)) {
    pythKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
    );
    console.log('Using existing keypair:', pythKeypair.publicKey.toBase58());
  } else {
    pythKeypair = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(pythKeypair.secretKey)));
    console.log('Created new keypair:', pythKeypair.publicKey.toBase58());
  }

  // Check if account exists
  const existing = await connection.getAccountInfo(pythKeypair.publicKey);
  if (existing && existing.data.readBigInt64LE(16) !== BigInt(0)) {
    console.log('✅ Price feed already exists with valid data');
    const price = existing.data.readBigInt64LE(16);
    console.log(`   Price: $${Number(price) / 1e8}`);
    return;
  }

  // Create account dump JSON for solana-test-validator
  const dataSize = 128;
  const priceData = Buffer.alloc(dataSize);
  
  // Price = $100 with 8 decimals = 10_000_000_000
  const price = BigInt(10_000_000_000);
  const confidence = BigInt(10_000_000);
  
  priceData.writeBigInt64LE(price, 16);
  priceData.writeBigUInt64LE(confidence, 24);

  const lamports = await connection.getMinimumBalanceForRentExemption(dataSize);

  // Create the account dump file in Solana's expected format
  const accountDump = {
    pubkey: pythKeypair.publicKey.toBase58(),
    account: {
      lamports: lamports,
      data: [priceData.toString('base64'), 'base64'],
      owner: SystemProgram.programId.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: dataSize,
    },
  };

  const dumpPath = './pyth-price-feed.json';
  fs.writeFileSync(dumpPath, JSON.stringify(accountDump, null, 2));

  console.log('\n📝 Created account dump file:', dumpPath);
  console.log('\n⚠️  To use this mock price feed, restart your validator with:');
  console.log(`\n   solana-test-validator --account ${pythKeypair.publicKey.toBase58()} ${dumpPath} --reset\n`);
  console.log('   Or add --account-dir . to load all JSON account files\n');
  console.log('Price feed address:', pythKeypair.publicKey.toBase58());
}

main().catch(console.error);
