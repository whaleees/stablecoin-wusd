use anchor_lang::prelude::*;
use crate::errors::*;

/// Parse price from either Pyth oracle or our MockPriceFeed
pub fn parse_pyth_price(account_data: &[u8]) -> Result<(i64, u64)> {
    if account_data.len() < 32 {
        return Err(StableError::InvalidOracle.into());
    }
    
    // Check if this is our MockPriceFeed account (has Anchor discriminator)
    // MockPriceFeed layout: [8 bytes discriminator][8 bytes price][8 bytes confidence][8 bytes last_update][1 byte bump]
    let mock_discriminator: [u8; 8] = [73, 0, 218, 41, 7, 202, 200, 152]; // sha256("account:MockPriceFeed")[..8]
    
    if account_data.len() >= 25 && account_data[..8] == mock_discriminator {
        // This is our MockPriceFeed PDA
        let price_bytes = &account_data[8..16];
        let price = i64::from_le_bytes(price_bytes.try_into().unwrap());
        
        let conf_bytes = &account_data[16..24];
        let conf = u64::from_le_bytes(conf_bytes.try_into().unwrap());
        
        return Ok((price, conf));
    }
    
    // Otherwise, parse as Pyth format (price at offset 16)
    let price_bytes = &account_data[16..24];
    let price = i64::from_le_bytes(price_bytes.try_into().unwrap());
    
    let conf_bytes = &account_data[24..32];
    let conf = u64::from_le_bytes(conf_bytes.try_into().unwrap());
    
    Ok((price, conf))
}