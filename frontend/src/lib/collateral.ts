import { PublicKey } from "@solana/web3.js";

export interface CollateralConfig {
  symbol: string;
  name: string;
  decimals: number;
  mint: PublicKey;
  pool: PublicKey;
  priceFeed: PublicKey;
  pythFeedId: string | null;
  collateralFactor: number; // LTV in basis points
  liquidationFactor: number;
  icon: string; // emoji fallback
  image: string; // path to token image
}

// Protocol addresses from devnet deployment
export const PROTOCOL_ADDRESSES = {
  PROGRAM_ID: new PublicKey("DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz"),
  GLOBAL_STATE: new PublicKey("CHu6hpKyp3h6ibJgr7cSP752wYnMwbqkxc4qh8WxUuTN"),
  POOL_REGISTRY: new PublicKey("AZ5xZAp3UefmMyZCq8NcmF5patw3u8Eqbd6JBYuuRAtG"),
};

export const COLLATERAL_CONFIGS: CollateralConfig[] = [
  {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    mint: new PublicKey("So11111111111111111111111111111111111111112"),
    pool: new PublicKey("2uD4sVNxt2nbnZ6mo5DVZiQDD9E7Zovz6phMW4v6FeAK"),
    priceFeed: new PublicKey("BVugLT3P6v2xygktYJ9j3NzXsErjvBvdpLf8d9orxGBy"),
    pythFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    collateralFactor: 7500,
    liquidationFactor: 8000,
    icon: "◎",
    image: "/tokens/sol.png",
  },
  {
    symbol: "wBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    mint: new PublicKey("AqfkoaHX94VHGTeA8gcB9M6PtQEPufS5e31t3ffv4JuU"),
    pool: new PublicKey("HngbEZ1NxKhQXtaKzeZdzyFJDid94nBJqokQ4hNMNbxh"),
    priceFeed: new PublicKey("GkvcSnYnqAUnUVPe3UXavL3MDRo89kqorV27a4knW1My"),
    pythFeedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    collateralFactor: 7000,
    liquidationFactor: 7500,
    icon: "₿",
    image: "/tokens/btc.png",
  },
  {
    symbol: "wETH",
    name: "Wrapped Ethereum",
    decimals: 8,
    mint: new PublicKey("HHcq6rR2wn6LEnAMiP3UaLNzTksEELfWayBA3bsFf3RR"),
    pool: new PublicKey("DByTKvq1TNYqHBpB8uDSEABKBNqN4MjgNE5YuUGGFAq9"),
    priceFeed: new PublicKey("HY8wnGGawmdb99mzJ2SDgjuj6FRM2x3LTiPcmaMubbwT"),
    pythFeedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    collateralFactor: 7500,
    liquidationFactor: 8000,
    icon: "Ξ",
    image: "/tokens/eth.png",
  },
  {
    symbol: "wSUI",
    name: "Wrapped Sui",
    decimals: 9,
    mint: new PublicKey("HyXTUixFiaLpWYgzGYm2taHVnSFbd29P7HJqzCW97xXj"),
    pool: new PublicKey("btir7hW1j3WMRceyuEr6s7Ys4wtztu1fYPGisbUE3eH"),
    priceFeed: new PublicKey("y4vD4c5BMKm4PqQu9oWZVbJVfJNBZPWyEajg7wTmb7R"),
    pythFeedId: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    collateralFactor: 6500,
    liquidationFactor: 7000,
    icon: "💧",
    image: "/tokens/sui.png",
  },
];

export function getCollateralBySymbol(symbol: string): CollateralConfig | undefined {
  return COLLATERAL_CONFIGS.find(c => c.symbol === symbol);
}

export function getCollateralByMint(mint: PublicKey): CollateralConfig | undefined {
  return COLLATERAL_CONFIGS.find(c => c.mint.equals(mint));
}

// Seeds for PDA derivation
export const SEEDS = {
  GLOBAL: Buffer.from("global_state"),
  POOL: Buffer.from("collateral_pool"),
  VAULT: Buffer.from("user_vault"),
  POOL_REGISTRY: Buffer.from("pool_registry"),
  MOCK_PRICE: Buffer.from("mock_price_feed"),
  MINT_AUTHORITY: Buffer.from("mint_authority"),
};
