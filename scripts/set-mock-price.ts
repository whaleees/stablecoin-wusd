import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as fs from 'fs';

const PROGRAM_ID = new PublicKey('DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz');
const SEED_GLOBAL = Buffer.from('global_state');
const SEED_MOCK_PRICE = Buffer.from('mock_price_feed');

async function main() {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  // Load admin wallet
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8')
      )
    )
  );

  // Derive PDAs
  const [globalStatePda] = PublicKey.findProgramAddressSync(
    [SEED_GLOBAL],
    PROGRAM_ID
  );

  const [mockPriceFeedPda, mockPriceBump] = PublicKey.findProgramAddressSync(
    [SEED_MOCK_PRICE],
    PROGRAM_ID
  );

  // SOL price = $100 with 8 decimals
  const price = BigInt(10_000_000_000); // $100.00
  const confidence = BigInt(10_000_000); // $0.10

  console.log('Setting mock price...');
  console.log('  Admin:', adminKeypair.publicKey.toBase58());
  console.log('  GlobalState PDA:', globalStatePda.toBase58());
  console.log('  MockPriceFeed PDA:', mockPriceFeedPda.toBase58());
  console.log('  Price: $100.00');
  console.log('  Confidence: $0.10');

  // Build instruction data manually
  // Discriminator for set_mock_price + price (i64) + confidence (u64)
  // sha256("global:set_mock_price")[..8]
  const discriminator = Buffer.from([161, 22, 71, 90, 159, 254, 26, 48]); // set_mock_price discriminator
  
  const data = Buffer.alloc(8 + 8 + 8); // discriminator + price + confidence
  discriminator.copy(data, 0);
  data.writeBigInt64LE(price, 8);
  data.writeBigUInt64LE(confidence, 16);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: globalStatePda, isSigner: false, isWritable: false },
      { pubkey: mockPriceFeedPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = adminKeypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(adminKeypair);

  try {
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, 'confirmed');
    
    console.log('\n✅ Mock price set successfully!');
    console.log('   TX:', sig);
    console.log('\n📝 Update your frontend/.env.local:');
    console.log(`   NEXT_PUBLIC_PRICE_FEED=${mockPriceFeedPda.toBase58()}`);
  } catch (e: any) {
    console.error('Error:', e.message);
    if (e.logs) console.error('Logs:', e.logs);
  }
}

main();
