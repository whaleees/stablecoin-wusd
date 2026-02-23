use anchor_lang::prelude::*;

#[event]
pub struct GlobalStateInitialized {
    pub admin: Pubkey,
    pub stablecoin_mint: Pubkey,
    pub debt_ceiling: u64,
    pub timestamp: i64,
}

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub collateral_amount: u64,
    pub shares_minted: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub collateral_amount: u64,
    pub shares_burned: u64,
    pub timestamp: i64,
}

#[event]
pub struct MintStableEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub stable_amount: u64,
    pub debt_amount: u64,
    pub collateral_ratio: u64,
    pub timestamp: i64,
}

#[event]
pub struct RepayEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub stable_amount: u64,
    pub principal_paid: u64,  
    pub interest_paid: u64,
    pub timestamp: i64,
}

#[event]
pub struct LiquidateEvent {
    pub liquidator: Pubkey,
    pub user: Pubkey,
    pub pool: Pubkey,
    pub debt_repaid: u64,
    pub collateral_taken: u64,
    pub bonus: u64,
    pub timestamp: i64,
}

#[event]
pub struct PoolInitialized {
    pub admin: Pubkey,
    pub pool: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_factor: u64,
    pub liquidation_factor: u64,
    pub timestamp: i64,
}