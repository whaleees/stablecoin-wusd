import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

// Token configurations - devnet test tokens
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

const RPC_URL = process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  try {
    const { wallet, token } = await request.json();

    // Validate wallet address
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // Load faucet keypair from environment
    const faucetKey = process.env.FAUCET_PRIVATE_KEY;
    if (!faucetKey) {
      return NextResponse.json(
        { error: "Faucet not configured. Set FAUCET_PRIVATE_KEY environment variable." },
        { status: 500 }
      );
    }

    let faucetKeypair: Keypair;
    try {
      const secretKey = JSON.parse(faucetKey);
      faucetKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    } catch {
      return NextResponse.json(
        { error: "Invalid faucet key configuration" },
        { status: 500 }
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const results: { token: string; amount: number; success: boolean; error?: string; signature?: string }[] = [];

    // Determine which tokens to mint
    const tokensToMint = token && TOKENS[token] 
      ? { [token]: TOKENS[token] }
      : TOKENS;

    for (const [symbol, config] of Object.entries(tokensToMint)) {
      try {
        const mint = new PublicKey(config.mint);

        // Get or create recipient's token account
        const recipientAta = await getOrCreateAssociatedTokenAccount(
          connection,
          faucetKeypair,
          mint,
          recipientPubkey
        );

        // Mint tokens
        const amountToMint = BigInt(config.amount) * BigInt(10 ** config.decimals);
        const signature = await mintTo(
          connection,
          faucetKeypair,
          mint,
          recipientAta.address,
          faucetKeypair.publicKey, // mint authority
          amountToMint
        );

        results.push({
          token: symbol,
          amount: config.amount,
          success: true,
          signature,
        });
      } catch (err) {
        results.push({
          token: symbol,
          amount: config.amount,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);

    return NextResponse.json({
      success: anySuccess,
      message: allSuccess 
        ? "All tokens minted successfully!" 
        : anySuccess 
          ? "Some tokens minted successfully"
          : "Failed to mint tokens",
      results,
    });
  } catch (err) {
    console.error("Faucet error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process faucet request" },
      { status: 500 }
    );
  }
}
