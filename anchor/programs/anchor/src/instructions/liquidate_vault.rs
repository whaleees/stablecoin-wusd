use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer, Burn};

use crate::constants::*;
use crate::errors::StableError;
use crate::events::LiquidateEvent;
use crate::states::*;
use crate::utils::oracle::*;

pub fn liquidate_vault(
    ctx: Context<LiquidateVault>,
    debt_to_repay: u64,
) -> Result<()> {
    require!(debt_to_repay > 0, StableError::InvalidParameter);
    
    let pool_key = ctx.accounts.pool.key();
    let user_key = ctx.accounts.user_vault.owner;
    let liquidator_key = ctx.accounts.liquidator.key();
    
    let pool = &ctx.accounts.pool;
    let user_vault = &mut ctx.accounts.user_vault;
    let global_state = &mut ctx.accounts.global_state;
    
    require!(pool.is_active, StableError::PoolNotActive);
    require!(
        user_vault.pool == pool_key,
        StableError::InvalidPool
    );
    require!(
        ctx.accounts.stablecoin_mint.key() == global_state.stablecoin_mint,
        StableError::InvalidPool
    );
    
    // get current price from oracle
    let price_data = ctx.accounts.price_feed.data.borrow();
    let (price, _confidence) = parse_pyth_price(&price_data)?;
    
    let collateral_amount = user_vault.collateral_shares
        .checked_mul(pool.total_collateral)
        .ok_or(StableError::Overflow)?
        .checked_div(pool.total_shares.max(1))
        .ok_or(StableError::Overflow)?;
    
    // calculate collateral value
    let collateral_decimals = ctx.accounts.collateral_mint.decimals;
    let collateral_value = collateral_amount
        .checked_mul(price as u64)
        .ok_or(StableError::Overflow)?
        .checked_div(10u64.pow(collateral_decimals as u32))
        .ok_or(StableError::Overflow)?;
    
    let current_time = Clock::get()?.unix_timestamp;
    let time_elapsed = current_time - user_vault.last_update;
    
    let new_interest = if time_elapsed > 0 && user_vault.debt_amount > 0 {
        let apr_bps = global_state.stability_fee;
        let interest_rate = (apr_bps as f64) / (BASIS_POINTS_DIVISOR as f64);
        let per_second_rate = interest_rate / 31536000.0;
        
        ((user_vault.debt_amount as f64) * per_second_rate * (time_elapsed as f64)) as u64
    } else {
        0
    };
    
    // calculate total debt
    let total_debt = user_vault.debt_amount
        .checked_add(user_vault.accrued_interest)
        .ok_or(StableError::Overflow)?
        .checked_add(new_interest)
        .ok_or(StableError::Overflow)?;
    
    // calculate collateral ratio
    let collateral_ratio = collateral_value
        .checked_mul(BASIS_POINTS_DIVISOR)
        .ok_or(StableError::Overflow)?
        .checked_div(total_debt.max(1))
        .ok_or(StableError::Overflow)?;
    
    // check if vault is liquidatable
    require!(
        collateral_ratio < pool.liquidation_factor,
        StableError::CannotLiquidateHealthyVault
    );
    
    // limit liquidation amount (max 50% of debt per liquidation)
    let max_liquidation = total_debt
        .checked_mul(5000)
        .ok_or(StableError::Overflow)?
        .checked_div(BASIS_POINTS_DIVISOR)
        .ok_or(StableError::Overflow)?;
    
    let actual_debt_to_repay = debt_to_repay.min(max_liquidation).min(total_debt);
    require!(actual_debt_to_repay > 0, StableError::InvalidParameter);
    
    // burn liquidators stablecoins
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.stablecoin_mint.to_account_info(),
            from: ctx.accounts.liquidator_stable_account.to_account_info(),
            authority: ctx.accounts.liquidator.to_account_info(),
        },
    );
    
    token::burn(burn_ctx, actual_debt_to_repay)?;
    
    // calculate collateral to give (with liq bonus)
    let liquidation_penalty_bps = global_state.liquidation_penalty; 
    let collateral_value_to_take = actual_debt_to_repay
        .checked_mul(BASIS_POINTS_DIVISOR + liquidation_penalty_bps)
        .ok_or(StableError::Overflow)?
        .checked_div(BASIS_POINTS_DIVISOR)
        .ok_or(StableError::Overflow)?;
    
    // convert value back to collateral tokens
    let collateral_to_take = collateral_value_to_take
        .checked_mul(10u64.pow(ctx.accounts.collateral_mint.decimals as u32))
        .ok_or(StableError::Overflow)?
        .checked_div(price as u64)
        .ok_or(StableError::Overflow)?;
    
    // convert to shares
    let shares_to_take = collateral_to_take
        .checked_mul(pool.total_shares)
        .ok_or(StableError::Overflow)?
        .checked_div(pool.total_collateral)
        .ok_or(StableError::Overflow)?;
    
    require!(
        shares_to_take <= user_vault.collateral_shares,
        StableError::InsufficientShares
    );
    
    // transfer collateral to liquidator
    let bump = ctx.bumps.pool;
    let seeds = &[
        SEED_POOL,
        ctx.accounts.pool_collateral_account.mint.as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];
    
    let pool_info = ctx.accounts.pool.to_account_info();
    
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_collateral_account.to_account_info(),
            to: ctx.accounts.liquidator_collateral_account.to_account_info(),
            authority: pool_info,
        },
        signer_seeds,
    );
    
    token::transfer(transfer_ctx, collateral_to_take)?;
    
    let pool_mut = &mut ctx.accounts.pool;
    
    // update vault
    user_vault.collateral_shares = user_vault.collateral_shares
        .checked_sub(shares_to_take)
        .ok_or(StableError::Overflow)?;
    
    let mut remaining_debt_repay = actual_debt_to_repay;
    let mut interest_paid_total = 0u64;

    if user_vault.accrued_interest > 0 && remaining_debt_repay > 0 {
        let interest_paid = user_vault.accrued_interest.min(remaining_debt_repay);

        user_vault.accrued_interest = user_vault.accrued_interest
            .checked_sub(interest_paid)
            .ok_or(StableError::Overflow)?;

        remaining_debt_repay = remaining_debt_repay
            .checked_sub(interest_paid)
            .ok_or(StableError::Overflow)?;

        interest_paid_total = interest_paid_total
            .checked_add(interest_paid)
            .ok_or(StableError::Overflow)?;
    }

    if new_interest > 0 && remaining_debt_repay > 0 {
        let interest_paid = new_interest.min(remaining_debt_repay);

        remaining_debt_repay = remaining_debt_repay
            .checked_sub(interest_paid)
            .ok_or(StableError::Overflow)?;

        interest_paid_total = interest_paid_total
            .checked_add(interest_paid)
            .ok_or(StableError::Overflow)?;
    }

    let principal_paid = remaining_debt_repay.min(user_vault.debt_amount);
    user_vault.debt_amount = user_vault.debt_amount
        .checked_sub(principal_paid)
        .ok_or(StableError::Overflow)?;

    global_state.total_debt = global_state.total_debt
        .checked_sub(principal_paid)
        .ok_or(StableError::Overflow)?;

    pool_mut.total_collateral = pool_mut.total_collateral
        .checked_sub(collateral_to_take)
        .ok_or(StableError::Overflow)?;

    pool_mut.total_shares = pool_mut.total_shares
        .checked_sub(shares_to_take)
        .ok_or(StableError::Overflow)?;
    
    user_vault.last_update = current_time;
    
    let bonus = collateral_value_to_take
        .checked_sub(actual_debt_to_repay)
        .ok_or(StableError::Overflow)?;
    
    emit!(LiquidateEvent {
        liquidator: liquidator_key,
        user: user_key,
        pool: pool_key,
        debt_repaid: actual_debt_to_repay,
        collateral_taken: collateral_to_take,
        bonus,
        timestamp: current_time,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct LiquidateVault<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    
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

    #[account(mut)]
    pub stablecoin_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [SEED_POOL, collateral_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, CollateralPool>,
    
    #[account(
        mut,
        seeds = [SEED_VAULT, user_vault.owner.as_ref(), pool.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,
    
    /// CHECK: Pyth price feed account - validated by parse_pyth_price
    pub price_feed: AccountInfo<'info>,
    
    #[account(
        mut,
        constraint = liquidator_stable_account.owner == liquidator.key(),
        constraint = liquidator_stable_account.mint == stablecoin_mint.key(),
    )]
    pub liquidator_stable_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = liquidator_collateral_account.owner == liquidator.key(),
        constraint = liquidator_collateral_account.mint == pool_collateral_account.mint,
    )]
    pub liquidator_collateral_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = pool,
    )]
    pub pool_collateral_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}