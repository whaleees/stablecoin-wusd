use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub owner: Pubkey,           // 32 bytes
    pub pool: Pubkey,            // 32 bytes
    
    pub collateral_shares: u64,  // 8 bytes
    pub debt_amount: u64,        // 8 bytes
    pub accrued_interest: u64,   // 8 bytes
    
    pub last_update: i64,        // 8 bytes
    pub bump: u8,                // 1 byte
}

#[account]
#[derive(InitSpace)]
pub struct CollateralPool {
    pub mint: Pubkey,             // 32 bytes
    pub total_collateral: u64,    // 8 bytes
    pub total_shares: u64,        // 8 bytes
    pub collateral_factor: u64,   // 8 bytes
    pub liquidation_factor: u64,  // 8 bytes
    pub interest_rate_model: Pubkey, // 32 bytes
    pub is_active: bool,          // 1 byte
    pub bump: u8,                 // 1 byte
}

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub admin: Pubkey,                    // 32 bytes
    pub stablecoin_mint: Pubkey,          // 32 bytes
    pub governance_token_mint: Pubkey,    // 32 bytes
    pub total_debt: u64,                  // 8 bytes
    pub debt_ceiling: u64,                // 8 bytes
    pub stability_fee: u64,               // 8 bytes
    pub liquidation_penalty: u64,         // 8 bytes
    pub pool_count: u64,                  // 8 bytes
    pub bump: u8,                         // 1 byte
}

#[account]
#[derive(InitSpace)]
pub struct PoolRegistry {
    pub authority: Pubkey,                
    
    #[max_len(10)]
    pub pools: Vec<Pubkey>,               
    pub bump: u8,                         
}

/// Mock price feed for local testing (per collateral)
#[account]
#[derive(InitSpace)]
pub struct MockPriceFeed {
    pub collateral_mint: Pubkey, // 32 bytes - which collateral this price is for
    pub price: i64,              // 8 decimals
    pub confidence: u64,         // 8 decimals
    pub last_update: i64,        // unix timestamp
    pub bump: u8,
}