use anchor_lang::prelude::*;
declare_id!("DbzvMaPVGPJrGW2t16dn6sgu8rnnpXZLNiqhtZ61rUFz");

pub mod states;
pub mod errors;
pub mod utils;
pub mod constants;
pub mod events;

pub mod instructions;
use instructions::*;

#[program]
pub mod anchor {
    use super::*;

    pub fn test_minimal(ctx: Context<TestMinimal>) -> Result<()> {
        instructions::test_minimal(ctx)
    }
    pub fn initialize_global_state(
        ctx: Context<InitializeGlobalState>,
        debt_ceiling: u64,
        stability_fee: u64,
        liquidation_penalty: u64,
    ) -> Result<()> {
        instructions::initialize_global_state(ctx, debt_ceiling, stability_fee, liquidation_penalty)
    }

    pub fn initialize_pool_registry(
        ctx: Context<InitializePoolRegistry>,
    ) -> Result<()> {
        instructions::initialize_pool_registry(ctx)
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::deposit(ctx, collateral_amount)
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        shares_to_burn: u64,
    ) -> Result<()> {
        instructions::withdraw(ctx, shares_to_burn)
    }

    pub fn mint_stable(ctx: Context<MintStable>, stable_amount: u64) -> Result<()> {
        instructions::mint_stable(ctx, stable_amount)
    }

    pub fn repay(ctx: Context<Repay>, repay_amount: u64) -> Result<()> {
        instructions::repay(ctx, repay_amount)
    }

    pub fn liquidate_vault(ctx: Context<LiquidateVault>, debt_to_repay: u64) -> Result<()> {
        instructions::liquidate_vault(ctx, debt_to_repay)
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        collateral_factor: u64,
        liquidation_factor: u64,
        interest_rate_model: Pubkey,
    ) -> Result<()> {
        instructions::initialize_pool(ctx, collateral_factor, liquidation_factor, interest_rate_model)
    }

    /// Set mock price for local testing (admin only)
    pub fn set_mock_price(ctx: Context<SetMockPrice>, price: i64, confidence: u64) -> Result<()> {
        instructions::set_mock_price(ctx, price, confidence)
    }

}