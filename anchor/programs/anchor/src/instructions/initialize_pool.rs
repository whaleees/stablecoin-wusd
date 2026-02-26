use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::constants::*;
use crate::states::*;
use crate::errors::*;
use crate::events::*;

pub fn initialize_pool(
    ctx: Context<InitializePool>,
    collateral_factor: u64,
    liquidation_factor: u64,
    interest_rate_model: Pubkey,
) -> Result<()> {
    require!(collateral_factor > 0, StableError::InvalidParameter);
    require!(liquidation_factor > 0, StableError::InvalidParameter);
    // LTV (collateral_factor) must be lower than liquidation threshold
    require!(collateral_factor < liquidation_factor, StableError::InvalidParameter);
    
    let global_state = &mut ctx.accounts.global_state;
    let pool_registry = &mut ctx.accounts.pool_registry;
    let pool = &mut ctx.accounts.pool;
    
    require!(
        pool_registry.pools.len() < MAX_POOLS,
        StableError::MaxPoolsReached
    );
    
    require!(
        global_state.admin == ctx.accounts.admin.key(),
        StableError::Unauthorized
    );
    
    // Initialize pool
    pool.mint = ctx.accounts.collateral_mint.key();
    pool.total_collateral = 0;
    pool.total_shares = 0;
    pool.collateral_factor = collateral_factor;
    pool.liquidation_factor = liquidation_factor;
    pool.interest_rate_model = interest_rate_model;
    pool.is_active = true;
    pool.bump = ctx.bumps.pool;
    
    // Add to registry
    pool_registry.pools.push(pool.key());
    
    // Update global state count
    global_state.pool_count = global_state.pool_count
        .checked_add(1)
        .ok_or(StableError::Overflow)?;
    
    emit!(PoolInitialized {
        admin: ctx.accounts.admin.key(),
        pool: pool.key(),
        collateral_mint: pool.mint,
        collateral_factor,
        liquidation_factor,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [SEED_GLOBAL],
        bump = global_state.bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        mut,
        seeds = [SEED_POOL_REGISTRY],
        bump = pool_registry.bump,
        realloc = 8 + PoolRegistry::INIT_SPACE,
        realloc::payer = admin,
        realloc::zero = false,
    )]
    pub pool_registry: Account<'info, PoolRegistry>,
    
    pub collateral_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + CollateralPool::INIT_SPACE,
        seeds = [SEED_POOL, collateral_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, CollateralPool>,
    
    pub system_program: Program<'info, System>,
}