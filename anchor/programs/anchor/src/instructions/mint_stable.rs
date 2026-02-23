use anchor_lang::prelude::*;
use crate::constants::*;
use crate::states::*;
use anchor_spl::token::{self, MintTo, Mint, TokenAccount, Token};
use crate::errors::*;
use crate::events::*;
use crate::utils::oracle::*;

pub fn mint_stable(ctx: Context<MintStable>, stable_amount: u64) -> Result<()> {
    require!(stable_amount > 0, StableError::InvalidParameter);

    let pool_key  = ctx.accounts.pool.key();
    let user_key = ctx.accounts.user.key();

    let pool = &mut ctx.accounts.pool;
    let user_vault = &mut ctx.accounts.user_vault;
    let global_state = &mut ctx.accounts.global_state;

    require!(pool.is_active, StableError::PoolNotActive);
    require!(
        user_vault.owner == user_key && user_vault.pool == pool_key,
        StableError::InvalidPool
    );

    let new_total_debt = global_state.total_debt
        .checked_add(stable_amount)
        .ok_or(StableError::Overflow)?;

    require!(
        new_total_debt <= global_state.debt_ceiling,
        StableError::DebtCeilingReached
    );

    // get collateral price from oracle using your parse_pyth_price function
    let price_data = ctx.accounts.price_feed.data.borrow();
    let (price, _confidence) = parse_pyth_price(&price_data)?;
    
    msg!("DEBUG: price from oracle = {}", price);
    
    // calculate user's collateral amount (in tokens) using u128 to prevent overflow
    let user_collateral_amount = ((user_vault.collateral_shares as u128)
        .checked_mul(pool.total_collateral as u128)
        .ok_or(StableError::Overflow)?
        .checked_div((pool.total_shares as u128).max(1))
        .ok_or(StableError::Overflow)?) as u64;

    msg!("DEBUG: user_collateral_amount = {}", user_collateral_amount);

    // calculate collateral value in USD (use u128 to avoid overflow)
    // price has 8 decimals, collateral has 9 decimals (SOL), WUSD has 6 decimals
    // collateral_value = (collateral_amount * price) / 10^collateral_decimals / 10^(price_decimals - wusd_decimals)
    // = (collateral_amount * price) / 10^9 / 10^2 = (collateral_amount * price) / 10^11
    let collateral_decimals = ctx.accounts.collateral_mint.decimals;
    let price_decimals: u32 = 8;
    let wusd_decimals: u32 = 6;
    
    // Use u128 for intermediate calculation to prevent overflow
    let collateral_value_u128 = (user_collateral_amount as u128)
        .checked_mul(price as u128)
        .ok_or(StableError::Overflow)?
        .checked_div(10u128.pow(collateral_decimals as u32))
        .ok_or(StableError::Overflow)?
        .checked_div(10u128.pow(price_decimals - wusd_decimals))
        .ok_or(StableError::Overflow)?;
    
    let collateral_value = collateral_value_u128 as u64;
    
    msg!("DEBUG: collateral_decimals = {}, collateral_value = {}", collateral_decimals, collateral_value);

    let current_time = Clock::get()?.unix_timestamp;
    let time_elapsed = current_time - user_vault.last_update;

    let interest = if time_elapsed > 0 && user_vault.debt_amount > 0 {
        let apr_bps = global_state.stability_fee;
        let interest_rate = (apr_bps as f64) / (BASIS_POINTS_DIVISOR as f64);
        let per_second_rate = interest_rate / 31536000.0;

        ((user_vault.debt_amount as f64) * per_second_rate * (time_elapsed as f64)) as u64
    } else {
        0
    };

    // calculate total existing debt (principal + accrued + new interest)
    let total_existing_debt = user_vault.debt_amount
        .checked_add(user_vault.accrued_interest)
        .ok_or(StableError::Overflow)?
        .checked_add(interest)
        .ok_or(StableError::Overflow)?;

    // calculate new total debt after minting
    let new_total_debt_for_user = total_existing_debt
        .checked_add(stable_amount)
        .ok_or(StableError::Overflow)?;

    msg!("DEBUG: stable_amount = {}, new_total_debt = {}", stable_amount, new_total_debt_for_user);

    // calculate collateral ratio (in bps) using u128 to avoid overflow
    let collateral_ratio = (collateral_value as u128)
        .checked_mul(BASIS_POINTS_DIVISOR as u128)
        .ok_or(StableError::Overflow)?
        .checked_div((new_total_debt_for_user as u128).max(1))
        .ok_or(StableError::Overflow)? as u64;

    msg!("DEBUG: collateral_ratio = {} bps, required = {} bps", collateral_ratio, pool.collateral_factor);

    // check minimum collateral ratio
    require!(
        collateral_ratio >= pool.collateral_factor,
        StableError::CollateralRatioTooLowForMint
    );

    // update vault state
    // add new interest to accrued
    user_vault.accrued_interest = user_vault.accrued_interest
        .checked_add(interest)
        .ok_or(StableError::Overflow)?;

    // add new debt
    user_vault.debt_amount = user_vault.debt_amount
        .checked_add(stable_amount)
        .ok_or(StableError::Overflow)?;

    user_vault.last_update = current_time;

    // update global state
    global_state.total_debt = new_total_debt;

    // mint stablecoins to user
    let mint_authority_bump = ctx.bumps.mint_authority;
    let seeds = &[
        b"mint_authority".as_ref(),
        &[mint_authority_bump],
    ];

    let signer_seeds = &[&seeds[..]];

    let mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.stablecoin_mint.to_account_info(),
            to: ctx.accounts.user_stable_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        },
        signer_seeds,
    );

    token::mint_to(mint_ctx, stable_amount)?;

    emit!(MintStableEvent {
        user: user_key,
        pool: pool_key,
        stable_amount,
        debt_amount: user_vault.debt_amount,
        collateral_ratio,
        timestamp: current_time,
    });

    Ok(())    
}

#[derive(Accounts)]
pub struct MintStable<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_GLOBAL],
        bump = global_state.bump,
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        seeds = [SEED_POOL_REGISTRY],
        bump = pool_registry.bump,
        constraint = pool_registry.pools.contains(&pool.key()) @ StableError::InvalidPool
    )]
    pub pool_registry: Account<'info, PoolRegistry>,

    pub collateral_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = stablecoin_mint.key() == global_state.stablecoin_mint @ StableError::InvalidPool
    )]
    pub stablecoin_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [SEED_POOL, collateral_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, CollateralPool>,

    #[account(
        mut,
        seeds = [SEED_VAULT, user.key().as_ref(), pool.key().as_ref()],
        bump,
    )]
    pub user_vault: Account<'info, UserVault>,

    /// CHECK: Pyth price feed account - validated by parse_pyth_price
    pub price_feed: AccountInfo<'info>,

    #[account(
        mut,
        constraint = user_stable_account.owner == user.key(),
        constraint = user_stable_account.mint == stablecoin_mint.key(),
    )]
    pub user_stable_account: Account<'info, TokenAccount>,

    /// CHECK: PDA for minting stablecoins
    #[account(
        seeds = [b"mint_authority"],
        bump
    )]
    pub mint_authority: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}