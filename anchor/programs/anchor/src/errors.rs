use anchor_lang::prelude::*;

#[error_code]
pub enum StableError {
    #[msg("Invalid parameter")]
    InvalidParameter,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Maximum number of pools reached")]
    MaxPoolsReached,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Vault not found")]
    VaultNotFound,
    #[msg("Pool not active")]
    PoolNotActive,
    #[msg("Math overflow")]
    Overflow,
    #[msg("Vault not empty")]
    VaultNotEmpty,
    #[msg("Insufficient shares")]
    InsufficientShares,
    #[msg("Invalid pool")]
    InvalidPool,
    #[msg("Collateral ratio too low")]
    CollateralRatioTooLow,
        #[msg("Debt ceiling reached")]
    DebtCeilingReached,
    #[msg("Collateral ratio too low for minting")]
    CollateralRatioTooLowForMint,
    #[msg("Cannot liquidate healthy vault")]
    CannotLiquidateHealthyVault,
    #[msg("Oracle price too stale")]
    OraclePriceStale,
    #[msg("Oracle confidence too low")]
    OracleConfidenceLow,
    #[msg("Invalid oracle account")]
    InvalidOracle,
    #[msg("Repay amount exceeds debt")]
    RepayAmountExceedsDebt,
    #[msg("Liquidation amount too high")]
    LiquidationAmountTooHigh,
}