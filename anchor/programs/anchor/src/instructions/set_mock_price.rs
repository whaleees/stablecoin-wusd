use anchor_lang::prelude::*;
use crate::constants::*;
use crate::states::*;

/// Initialize or update a mock price feed for local testing
pub fn set_mock_price(ctx: Context<SetMockPrice>, price: i64, confidence: u64) -> Result<()> {
    let mock_price_feed = &mut ctx.accounts.mock_price_feed;
    
    mock_price_feed.price = price;
    mock_price_feed.confidence = confidence;
    mock_price_feed.last_update = Clock::get()?.unix_timestamp;
    mock_price_feed.bump = ctx.bumps.mock_price_feed;
    
    msg!("Mock price set: {} (conf: {})", price, confidence);
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(price: i64, confidence: u64)]
pub struct SetMockPrice<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [SEED_GLOBAL],
        bump = global_state.bump,
        constraint = global_state.admin == admin.key()
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + MockPriceFeed::INIT_SPACE,
        seeds = [SEED_MOCK_PRICE],
        bump
    )]
    pub mock_price_feed: Account<'info, MockPriceFeed>,

    pub system_program: Program<'info, System>,
}
