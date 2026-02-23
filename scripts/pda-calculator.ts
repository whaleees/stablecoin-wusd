import { PublicKey } from '@solana/web3.js';

/**
 * Helper script to calculate all PDAs for your WUSD protocol
 */

const PROGRAM_ID = new PublicKey('BkVyDX6zTMc2CXZRaH2vHBbVkTBVCyij1i6CXMoaPbsN');

// Seeds from your constants.rs
const SEED_GLOBAL = Buffer.from('global_state');
const SEED_POOL = Buffer.from('collateral_pool');
const SEED_VAULT = Buffer.from('user_vault');
const SEED_MINT_AUTHORITY = Buffer.from('mint_authority');
const SEED_POOL_REGISTRY = Buffer.from('pool_registry');

async function calculatePDAs(
  collateralMint?: PublicKey,
  userPubkey?: PublicKey
) {
  console.log('🔍 Calculating PDAs for WUSD Protocol\n');
  console.log('Program ID:', PROGRAM_ID.toBase58(), '\n');

  // 1. Global State PDA
  const [globalStatePDA, globalBump] = PublicKey.findProgramAddressSync(
    [SEED_GLOBAL],
    PROGRAM_ID
  );
  console.log('1️⃣  Global State PDA:');
  console.log('   Address:', globalStatePDA.toBase58());
  console.log('   Bump:', globalBump, '\n');

  // 2. Mint Authority PDA (for minting WUSD)
  const [mintAuthorityPDA, mintBump] = PublicKey.findProgramAddressSync(
    [SEED_MINT_AUTHORITY],
    PROGRAM_ID
  );
  console.log('2️⃣  Mint Authority PDA:');
  console.log('   Address:', mintAuthorityPDA.toBase58());
  console.log('   Bump:', mintBump);
  console.log('   ⚠️  Set this as the mint authority for WUSD mint!\n');

  // 3. Pool Registry PDA
  const [poolRegistryPDA, registryBump] = PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    PROGRAM_ID
  );
  console.log('3️⃣  Pool Registry PDA:');
  console.log('   Address:', poolRegistryPDA.toBase58());
  console.log('   Bump:', registryBump, '\n');

  // 3. Collateral Pool PDA (if collateral mint provided)
  if (collateralMint) {
    const [poolPDA, poolBump] = PublicKey.findProgramAddressSync(
      [SEED_POOL, collateralMint.toBuffer()],
      PROGRAM_ID
    );
    console.log('4️⃣  Collateral Pool PDA (for', collateralMint.toBase58(), '):');
    console.log('   Address:', poolPDA.toBase58());
    console.log('   Bump:', poolBump, '\n');

    // 4. User Vault PDA (if user pubkey also provided)
    if (userPubkey) {
      const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
        [SEED_VAULT, userPubkey.toBuffer(), poolPDA.toBuffer()],
        PROGRAM_ID
      );
      console.log('5️⃣  User Vault PDA:');
      console.log('   User:', userPubkey.toBase58());
      console.log('   Vault Address:', vaultPDA.toBase58());
      console.log('   Bump:', vaultBump, '\n');
    }
  }

  return {
    globalState: globalStatePDA,
    mintAuthority: mintAuthorityPDA,
  };
}

// Example usage
async function main() {
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Calculate basic PDAs
  const pdas = await calculatePDAs();

  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📝 To calculate Pool and Vault PDAs, run:\n');
  console.log('   calculatePDAs(collateralMintPubkey, userPubkey)\n');
  
  console.log('Example for SOL (wrapped SOL mint):');
  const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  const EXAMPLE_USER = new PublicKey('11111111111111111111111111111111');
  
  console.log('\n');
  await calculatePDAs(SOL_MINT, EXAMPLE_USER);
  
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);

// Export for use in other scripts
export { calculatePDAs, PROGRAM_ID, SEED_GLOBAL, SEED_POOL, SEED_VAULT, SEED_MINT_AUTHORITY, SEED_POOL_REGISTRY };