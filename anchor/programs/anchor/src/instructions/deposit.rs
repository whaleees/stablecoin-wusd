use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::*;
use crate::states::*;
use crate::events::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub fn deposit(ctx: Context<Deposit>, collateral_amount: u64) -> Result<()> {
    require!(collateral_amount > 0, StableError::InvalidParameter);

    let pool = &mut ctx.accounts.pool;
    let user_vault = &mut ctx.accounts.user_vault;

    require!(pool.is_active, StableError::PoolNotActive);

    // Initialize vault fields if this is a new vault (owner is zeroed)
    if user_vault.owner == Pubkey::default() {
        user_vault.owner = ctx.accounts.user.key();
        user_vault.pool = pool.key();
        user_vault.bump = ctx.bumps.user_vault;
    }

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(), 
        Transfer{
            from: ctx.accounts.user_collateral_account.to_account_info(),
            to: ctx.accounts.pool_collateral_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, collateral_amount)?;

    let shares = if pool.total_shares == 0 {
        collateral_amount
    } else {
        let shares_numerator = collateral_amount
            .checked_mul(pool.total_shares)
            .ok_or(StableError::Overflow)?;

        shares_numerator
            .checked_div(pool.total_collateral)
            .ok_or(StableError::Overflow)?
            .max(1)
    };

    pool.total_collateral = pool.total_collateral
        .checked_add(collateral_amount)
        .ok_or(StableError::Overflow)?;

    pool.total_shares = pool.total_shares
        .checked_add(shares)
        .ok_or(StableError::Overflow)?;

    user_vault.collateral_shares = user_vault.collateral_shares
        .checked_add(shares)
        .ok_or(StableError::Overflow)?;

    user_vault.last_update = Clock::get()?.unix_timestamp;

    emit!(DepositEvent {
        user: ctx.accounts.user.key(),
        pool: pool.key(),
        collateral_amount,
        shares_minted: shares,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
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
        token::authority = pool,
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
        init_if_needed,
        payer = user,
        space = 8 + UserVault::INIT_SPACE,
        seeds = [SEED_VAULT, user.key().as_ref(), pool.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}