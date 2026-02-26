/**
 * Token Faucet Script
 * 
 * Mints test tokens (wBTC, wETH, wSUI) to a specified wallet address.
 * 
 * Usage:
 *   npx ts-node scripts/faucet.ts <WALLET_ADDRESS>
 *   npx ts-node scripts/faucet.ts <WALLET_ADDRESS> <TOKEN_SYMBOL>
 * 
 * Examples:
 *   npx ts-node scripts/faucet.ts 5YourWalletAddressHere
 *   npx ts-node scripts/faucet.ts 5YourWalletAddressHere wBTC
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Token configurations
const TOKENS: Record<string, { mint: string; decimals: number; amount: number }> = {
  wBTC: {
    mint: "AqfkoaHX94VHGTeA8gcB9M6PtQEPufS5e31t3ffv4JuU",
    decimals: 8,
    amount: 1, // 1 wBTC
  },
  wETH: {
    mint: "HHcq6rR2wn6LEnAMiP3UaLNzTksEELfWayBA3bsFf3RR",
    decimals: 8,
    amount: 10, // 10 wETH
  },
  wSUI: {
    mint: "HyXTUixFiaLpWYgzGYm2taHVnSFbd29P7HJqzCW97xXj",
    decimals: 9,
    amount: 1000, // 1000 wSUI
  },
};

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";

function loadAdminKeypair(): Keypair {
  const keypairPath = process.env.WALLET_PATH || path.join(os.homedir(), ".config/solana/id.json");
  
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Keypair not found at ${keypairPath}. Set WALLET_PATH env variable.`);
  }
  
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

async function faucet(recipient: string, tokenSymbol?: string) {
  console.log("\n🚰 WUSD Token Faucet\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const admin = loadAdminKeypair();
  const recipientPubkey = new PublicKey(recipient);

  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`Recipient: ${recipientPubkey.toBase58()}\n`);

  const tokensToMint = tokenSymbol 
    ? { [tokenSymbol]: TOKENS[tokenSymbol] }
    : TOKENS;

  for (const [symbol, config] of Object.entries(tokensToMint)) {
    if (!config) {
      console.log(`❌ Unknown token: ${symbol}`);
      continue;
    }

    try {
      console.log(`Minting ${config.amount} ${symbol}...`);
      
      const mint = new PublicKey(config.mint);
      
      // Get or create recipient's token account
      const recipientAta = await getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        mint,
        recipientPubkey
      );

      // Mint tokens
      const amountWithDecimals = BigInt(config.amount) * BigInt(10 ** config.decimals);
      
      await mintTo(
        connection,
        admin,
        mint,
        recipientAta.address,
        admin,
        amountWithDecimals
      );

      console.log(`✅ Minted ${config.amount} ${symbol} to ${recipientAta.address.toBase58()}\n`);
    } catch (e: any) {
      console.log(`❌ Failed to mint ${symbol}: ${e.message}\n`);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Faucet complete!\n");
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage:
  npx ts-node scripts/faucet.ts <WALLET_ADDRESS>
  npx ts-node scripts/faucet.ts <WALLET_ADDRESS> <TOKEN_SYMBOL>

Available tokens: ${Object.keys(TOKENS).join(", ")}

Examples:
  npx ts-node scripts/faucet.ts 5YourWalletAddressHere
  npx ts-node scripts/faucet.ts 5YourWalletAddressHere wBTC
`);
  process.exit(1);
}

const [walletAddress, tokenSymbol] = args;

faucet(walletAddress, tokenSymbol).catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
