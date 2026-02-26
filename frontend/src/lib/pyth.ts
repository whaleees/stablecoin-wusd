"use client";

import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { HermesClient } from "@pythnetwork/hermes-client";

// Pyth Feed IDs - from https://pyth.network/developers/price-feed-ids
export const PYTH_FEED_IDS = {
  "SOL/USD": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SUI/USD": "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  "mSOL/USD": "0xc2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4",
};

// Pyth Hermes endpoints
const HERMES_ENDPOINTS = {
  mainnet: "https://hermes.pyth.network",
  devnet: "https://hermes.pyth.network", // Same for devnet, uses different feed accounts
};

// Pyth Solana Receiver Program IDs
const PYTH_RECEIVER_PROGRAM = {
  mainnet: new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"),
  devnet: new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"),
};

export interface PythPrice {
  price: number;
  confidence: number;
  publishTime: number;
  feedId: string;
}

/**
 * Fetch latest price from Pyth Hermes API
 */
export async function fetchPythPrice(
  feedId: string,
  cluster: "mainnet" | "devnet" = "devnet"
): Promise<PythPrice> {
  const endpoint = HERMES_ENDPOINTS[cluster];
  const hermesClient = new HermesClient(endpoint);

  const priceUpdates = await hermesClient.getLatestPriceUpdates([feedId]);
  
  if (!priceUpdates?.parsed || priceUpdates.parsed.length === 0) {
    throw new Error("Failed to fetch price from Pyth");
  }

  const priceFeed = priceUpdates.parsed[0];
  const priceData = priceFeed.price;
  
  if (!priceData) {
    throw new Error("Price data is missing");
  }

  return {
    price: Number(priceData.price) * Math.pow(10, priceData.expo),
    confidence: Number(priceData.conf) * Math.pow(10, priceData.expo),
    publishTime: Number(priceData.publish_time),
    feedId,
  };
}

/**
 * Get the price update instruction to include in a transaction
 * This creates a PriceUpdateV2 account that the program can read
 */
export async function getPythPriceUpdateData(
  feedId: string,
  cluster: "mainnet" | "devnet" = "devnet"
): Promise<{ updateData: string[]; publishTime: number }> {
  const endpoint = HERMES_ENDPOINTS[cluster];
  const hermesClient = new HermesClient(endpoint);

  const priceUpdates = await hermesClient.getLatestPriceUpdates([feedId], { encoding: "base64" });
  
  if (!priceUpdates?.parsed || priceUpdates.parsed.length === 0) {
    throw new Error("Failed to fetch price from Pyth");
  }

  const priceFeed = priceUpdates.parsed[0];
  
  return {
    updateData: priceUpdates.binary?.data || [],
    publishTime: Number(priceFeed.price?.publish_time || 0),
  };
}

/**
 * Build instructions to post Pyth price update
 * Uses the Pyth Solana Receiver program to create a PriceUpdateV2 account
 */
export async function buildPythUpdateInstructions(
  connection: Connection,
  payer: PublicKey,
  feedIds: string[],
  cluster: "mainnet" | "devnet" = "devnet"
): Promise<{
  instructions: TransactionInstruction[];
  priceUpdateAccounts: PublicKey[];
}> {
  // For now, we'll use a simplified approach:
  // The frontend will display the price, but the smart contract
  // will need to either:
  // 1. Use MockPriceFeed for testing
  // 2. Accept pre-posted PriceUpdateV2 accounts
  
  // In production, you'd use @pythnetwork/pyth-solana-receiver to:
  // 1. Post price updates using postPriceUpdate instruction
  // 2. Pass the resulting PriceUpdateV2 account to your program
  
  console.log("Pyth price update would be posted for feeds:", feedIds);
  
  // Return empty for now - this is a placeholder for full implementation
  return {
    instructions: [],
    priceUpdateAccounts: [],
  };
}

/**
 * Get display price for UI (formatted)
 */
export function formatPythPrice(price: number, decimals: number = 2): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Validate a feed ID
 */
export function isValidFeedId(feedId: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(feedId);
}
