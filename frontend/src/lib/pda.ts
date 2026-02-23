import { PublicKey } from "@solana/web3.js";

export const SEED_GLOBAL = Buffer.from("global_state");
export const SEED_POOL = Buffer.from("collateral_pool");
export const SEED_VAULT = Buffer.from("user_vault");
export const SEED_MINT_AUTHORITY = Buffer.from("mint_authority");
export const SEED_POOL_REGISTRY = Buffer.from("pool_registry");

export function findGlobalStatePda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_GLOBAL],
    programId
  );
}

export function findPoolRegistryPda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_POOL_REGISTRY],
    programId
  );
}

export function findPoolPda(
  programId: PublicKey,
  collateralMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_POOL, collateralMint.toBuffer()],
    programId
  );
}

export function findUserVaultPda(
  programId: PublicKey,
  user: PublicKey,
  pool: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEED_VAULT,
      user.toBuffer(),
      pool.toBuffer(),
    ],
    programId
  );
}

export function findMintAuthorityPda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_MINT_AUTHORITY],
    programId
  );
}
