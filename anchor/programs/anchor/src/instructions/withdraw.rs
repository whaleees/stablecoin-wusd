use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::*;
use crate::states::*;
use crate::events::*;

pub fn withdraw(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
    require!(shares_to_burn > 0, StableError::InvalidParameter);

    let pool_key = ctx.accounts.pool.key();
    
    let pool = &mut ctx.accounts.pool;
    let user_vault = &mut ctx.accounts.user_vault;

    require!(
        user_vault.pool == pool_key,
        StableError::InvalidPool
    );

    let pool_bump = pool.bump;

    require!(
        user_vault.collateral_shares >= shares_to_burn,
        StableError::InsufficientShares
    );

    // Use u128 for intermediate calculations to prevent overflow
    require!(pool.total_shares > 0, StableError::InvalidParameter);
    
    let collateral_to_withdraw = (shares_to_burn as u128)
        .checked_mul(pool.total_collateral as u128)
        .ok_or(StableError::Overflow)?
        .checked_div(pool.total_shares as u128)
        .ok_or(StableError::Overflow)? as u64;
    
    require!(
        collateral_to_withdraw > 0,
        StableError::InvalidParameter
    );

    if user_vault.debt_amount > 0 {
        // TODO: Add oracle check for collateral ratio
        require!(
            user_vault.debt_amount == 0,
            StableError::VaultNotEmpty
        );
    }

    user_vault.collateral_shares = user_vault.collateral_shares
        .checked_sub(shares_to_burn)
        .ok_or(StableError::Overflow)?;

    pool.total_collateral = pool.total_collateral
        .checked_sub(collateral_to_withdraw)
        .ok_or(StableError::Overflow)?;

    pool.total_shares = pool.total_shares
        .checked_sub(shares_to_burn)
        .ok_or(StableError::Overflow)?;

    let seeds = &[
        SEED_POOL, 
        ctx.accounts.pool_collateral_account.mint.as_ref(),
        &[pool_bump],
    ];
    let signer = &[&seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer{
            from: ctx.accounts.pool_collateral_account.to_account_info(),
            to: ctx.accounts.user_collateral_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        signer,
    );
    token::transfer(transfer_ctx, collateral_to_withdraw)?;
    
    user_vault.last_update = Clock::get()?.unix_timestamp;

    emit!(WithdrawEvent {
        user: ctx.accounts.user.key(),
        pool: pool_key, 
        collateral_amount: collateral_to_withdraw,
        shares_burned: shares_to_burn,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())    
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
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

    #[account(
        mut, 
        constraint = user_collateral_account.owner == user.key(),
        constraint = user_collateral_account.mint == pool_collateral_account.mint
    )]
    pub user_collateral_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pool_collateral_account.mint,
        token::authority = pool
    )]
    pub pool_collateral_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [SEED_POOL, pool_collateral_account.mint.as_ref()],
        bump = pool.bump,
        constraint = pool.mint == pool_collateral_account.mint.key() @ StableError::InvalidPool
    )]
    pub pool: Account<'info, CollateralPool>,

    #[account(
        mut,
        seeds = [SEED_VAULT, user.key().as_ref(), pool.key().as_ref()],
        bump = user_vault.bump,
        constraint = user_vault.owner == user.key() @ StableError::Unauthorized,
        constraint = user_vault.pool == pool.key() @ StableError::InvalidPool
    )]
    pub user_vault: Account<'info, UserVault>,

    pub token_program: Program<'info, Token>,
}