pub const SEED_GLOBAL: &[u8] = b"global_state";
pub const SEED_POOL: &[u8] = b"collateral_pool";
pub const SEED_VAULT: &[u8] = b"user_vault";
pub const SEED_POOL_REGISTRY: &[u8] = b"pool_registry";
pub const SEED_MOCK_PRICE: &[u8] = b"mock_price_feed";

pub const BASIS_POINTS_DIVISOR: u64 = 10_000;           // 100% = 10,000 bps
pub const MAX_POOLS: usize = 10;
pub const MAX_STABILITY_FEE_BPS: u64 = 10_000;          // Max 100%
pub const MAX_LIQUIDATION_PENALTY_BPS: u64 = 5_000;     // Max 50%