use anchor_lang::prelude::*;
use crate::errors::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

// Pyth Feed IDs from https://pyth.network/developers/price-feed-ids
pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
pub const BTC_USD_FEED_ID: &str = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
pub const ETH_USD_FEED_ID: &str = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
pub const SUI_USD_FEED_ID: &str = "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744";
// Note: HYPE doesn't have a Pyth feed yet, we'll use mock prices only

pub const MAXIMUM_AGE: u64 = 60 * 5; // 5 minutes staleness

/// Parse price from our MockPriceFeed account (per-collateral)
/// Layout: [8 discriminator][32 collateral_mint][8 price][8 confidence][8 last_update][1 bump]
/// Returns (price, confidence) both normalized to 8 decimal places
pub fn parse_pyth_price(account_data: &[u8]) -> Result<(i64, u64)> {
    if account_data.len() < 57 {
        return Err(StableError::InvalidOracle.into());
    }
    
    // Check if this is our MockPriceFeed account (has Anchor discriminator)
    let mock_discriminator: [u8; 8] = [73, 0, 218, 41, 7, 202, 200, 152];
    
    if account_data[..8] == mock_discriminator {
        // This is our MockPriceFeed PDA
        // Skip discriminator (8) + collateral_mint (32) = 40 bytes
        let price_bytes = &account_data[40..48];
        let price = i64::from_le_bytes(price_bytes.try_into().unwrap());
        
        let conf_bytes = &account_data[48..56];
        let conf = u64::from_le_bytes(conf_bytes.try_into().unwrap());
        
        return Ok((price, conf));
    }
    
    // Not a mock feed - return error, let the caller use PriceUpdateV2 directly
    Err(StableError::InvalidOracle.into())
}

/// Parse price directly from PriceUpdateV2 account using Pyth SDK
pub fn get_pyth_price(price_update: &Account<PriceUpdateV2>, clock: &Clock) -> Result<(i64, u64)> {
    let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)
        .map_err(|_| StableError::InvalidOracle)?;
    
    let price = price_update
        .get_price_no_older_than(clock, MAXIMUM_AGE, &feed_id)
        .map_err(|_| StableError::InvalidOracle)?;
    
    // Normalize to 8 decimal places
    // Pyth prices typically have exponent of -8
    let exponent = price.exponent;
    let scale = 8 + exponent; // exponent is typically negative
    
    let normalized_price = if scale >= 0 {
        price.price.checked_mul(10i64.pow(scale as u32)).unwrap_or(price.price)
    } else {
        price.price.checked_div(10i64.pow((-scale) as u32)).unwrap_or(price.price)
    };
    
    let normalized_conf = if scale >= 0 {
        price.conf.checked_mul(10u64.pow(scale as u32)).unwrap_or(price.conf)
    } else {
        price.conf.checked_div(10u64.pow((-scale) as u32)).unwrap_or(price.conf)
    };
    
    Ok((normalized_price, normalized_conf))
}