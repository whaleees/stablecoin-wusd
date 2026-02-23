use anchor_lang::prelude::*;
use crate::states::*;
use crate::constants::*;

pub fn initialize_global_state(
    ctx: Context<InitializeGlobalState>,
    debt_ceiling: u64,
    stability_fee: u64,
    liquidation_penalty: u64,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    global_state.admin = ctx.accounts.admin.key();
    global_state.stablecoin_mint = ctx.accounts.stablecoin_mint.key();
    global_state.governance_token_mint = ctx.accounts.governance_token_mint.key();
    global_state.total_debt = 0;
    global_state.debt_ceiling = debt_ceiling;
    global_state.stability_fee = stability_fee;
    global_state.liquidation_penalty = liquidation_penalty;
    global_state.pool_count = 0;
    global_state.bump = ctx.bumps.global_state;

    Ok(())
}

pub fn initialize_pool_registry(
    ctx: Context<InitializePoolRegistry>,
) -> Result<()> {
    let pool_registry = &mut ctx.accounts.pool_registry;

    pool_registry.authority = ctx.accounts.admin.key();
    pool_registry.pools = Vec::new();
    pool_registry.bump = ctx.bumps.pool_registry;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [SEED_GLOBAL],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    /// CHECK: only storing the pubkey, no need to deserialize the account
    pub stablecoin_mint: UncheckedAccount<'info>,
    
    /// CHECK: only storing the pubkey, no need to deserialize the account
    pub governance_token_mint: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePoolRegistry<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + PoolRegistry::INIT_SPACE,
        seeds = [SEED_POOL_REGISTRY],
        bump
    )]
    pub pool_registry: Account<'info, PoolRegistry>,

    pub system_program: Program<'info, System>,
}