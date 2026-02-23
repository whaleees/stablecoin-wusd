use anchor_lang::prelude::*;
use crate::errors::StableError;

pub fn calculate_shares_from_amount(
    amount: u64,
    total_shares: u64,
    total_amount: u64,
) -> Result<u64> {
    if total_shares == 0 {
        // First deposit: shares = amount
        Ok(amount)
    } else {
        let shares = amount
            .checked_mul(total_shares)
            .ok_or(StableError::Overflow)?
            .checked_div(total_amount)
            .ok_or(StableError::Overflow)?;
        
        // Minimum 1 share
        Ok(shares.max(1))
    }
}

pub fn calculate_amount_from_shares(
    shares: u64,
    total_amount: u64,
    total_shares: u64,
) -> Result<u64> {
    require!(total_shares > 0, StableError::InvalidParameter);
    
    let amount = shares
        .checked_mul(total_amount)
        .ok_or(StableError::Overflow)?
        .checked_div(total_shares)
        .ok_or(StableError::Overflow)?;
    
    Ok(amount)
}

pub fn calculate_collateralization_ratio(
    collateral_value: u64,
    debt_amount: u64,
) -> Result<u64> {
    if debt_amount == 0 {
        return Ok(u64::MAX); // Infinite ratio if no debt
    }
    
    let ratio = collateral_value
        .checked_mul(100) // Convert to percentage
        .ok_or(StableError::Overflow)?
        .checked_div(debt_amount)
        .ok_or(StableError::Overflow)?;
    
    Ok(ratio)
}