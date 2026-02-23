use anchor_lang::prelude::*;
use crate::events::*;
use crate::constants::*;
use crate::states::*;
use crate::errors::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};

pub fn repay(ctx: Context<Repay>, repay_amount: u64) -> Result<()> {
    require!(repay_amount > 0, StableError::InvalidParameter);

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

    // calculate total owed 
    let total_owed = user_vault.debt_amount
        .checked_add(user_vault.accrued_interest)
        .ok_or(StableError::Overflow)?
        .checked_add(new_interest)
        .ok_or(StableError::Overflow)?;

    require!(
        repay_amount <= total_owed,
        StableError::RepayAmountExceedsDebt
    );

    // burn stablecoins from user
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.stablecoin_mint.to_account_info(),
            from: ctx.accounts.user_stable_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );

    token::burn(burn_ctx, repay_amount)?;

    // track whats being paid
    let mut remaining_repay = repay_amount;
    let mut interest_paid = 0u64;
    let mut principal_paid = 0u64;

    // pay off the accrued interest
    if remaining_repay > 0 && user_vault.accrued_interest > 0 {
        let pay_accrued_interest = user_vault.accrued_interest.min(remaining_repay);
        
        user_vault.accrued_interest = user_vault.accrued_interest
            .checked_sub(pay_accrued_interest)
            .ok_or(StableError::Overflow)?;

        remaining_repay = remaining_repay
            .checked_sub(pay_accrued_interest)
            .ok_or(StableError::Overflow)?;

        interest_paid = interest_paid
            .checked_add(pay_accrued_interest)
            .ok_or(StableError::Overflow)?;
    }
    
    // pay off the new interest
    if remaining_repay > 0 && new_interest > 0 {
        let pay_new_interest = new_interest.min(remaining_repay);
        
        // new interest hasn't been added to accrued yet, so just track payment
        remaining_repay = remaining_repay
            .checked_sub(pay_new_interest)
            .ok_or(StableError::Overflow)?;
    
        interest_paid = interest_paid
            .checked_add(pay_new_interest)
            .ok_or(StableError::Overflow)?;
    }

    // pay off principal debt
    if remaining_repay > 0 && user_vault.debt_amount > 0 {
        let pay_principal = user_vault.debt_amount.min(remaining_repay);
        
        user_vault.debt_amount = user_vault.debt_amount
            .checked_sub(pay_principal)
            .ok_or(StableError::Overflow)?;

        principal_paid = pay_principal;

        global_state.total_debt = global_state.total_debt
            .checked_sub(pay_principal)
            .ok_or(StableError::Overflow)?;
    }
    
    user_vault.last_update = current_time;

    emit!(RepayEvent {
        user: user_key,
        pool: pool_key,
        stable_amount: repay_amount,
        principal_paid,
        interest_paid,
        timestamp: current_time,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Repay<'info> {
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
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        constraint = user_stable_account.owner == user.key(),
        constraint = user_stable_account.mint == stablecoin_mint.key()
    )]
    pub user_stable_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}