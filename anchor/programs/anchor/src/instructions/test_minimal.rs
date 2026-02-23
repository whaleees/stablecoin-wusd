use anchor_lang::prelude::*;

pub fn test_minimal(ctx: Context<TestMinimal>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    state.bump = ctx.bumps.state;
    Ok(())
}

#[derive(Accounts)]
pub struct TestMinimal<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + TestState::INIT_SPACE,
        seeds = [b"test"],
        bump
    )]
    pub state: Account<'info, TestState>,
    
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct TestState {
    pub bump: u8,
}