"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchPythPrice, PythPrice } from "@/lib/pyth";
import { COLLATERAL_CONFIGS, CollateralConfig } from "@/lib/collateral";

export interface PriceData {
  symbol: string;
  price: number;
  confidence: number;
  lastUpdate: Date;
  change24h?: number;
}

// Map collateral symbols to Pyth feed IDs
const SYMBOL_TO_FEED: Record<string, string> = {
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  wBTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  wETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  wSUI: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
};

interface UsePricesOptions {
  /** Refresh interval in milliseconds. Default: 500ms */
  interval?: number;
  /** Only fetch specific symbols */
  symbols?: string[];
  /** Enable/disable fetching */
  enabled?: boolean;
}

export function usePrices(options: UsePricesOptions = {}) {
  const { interval = 500, symbols, enabled = true } = options;
  
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const symbolsToFetch = useMemo(() => {
    if (symbols && symbols.length > 0) {
      return symbols.filter(s => SYMBOL_TO_FEED[s]);
    }
    return Object.keys(SYMBOL_TO_FEED);
  }, [symbols]);

  const fetchPrices = useCallback(async () => {
    if (!enabled || symbolsToFetch.length === 0) return;

    try {
      const results = await Promise.allSettled(
        symbolsToFetch.map(async (symbol) => {
          const feedId = SYMBOL_TO_FEED[symbol];
          const data = await fetchPythPrice(feedId, "devnet");
          return { symbol, data };
        })
      );

      const newPrices: Record<string, PriceData> = {};
      
      for (const result of results) {
        if (result.status === "fulfilled") {
          const { symbol, data } = result.value;
          newPrices[symbol] = {
            symbol,
            price: data.price,
            confidence: data.confidence,
            lastUpdate: new Date(data.publishTime * 1000),
          };
        }
      }

      setPrices(prev => ({ ...prev, ...newPrices }));
      setError(null);
    } catch (e) {
      console.error("Failed to fetch prices:", e);
      setError(e instanceof Error ? e.message : "Failed to fetch prices");
    } finally {
      setLoading(false);
    }
  }, [enabled, symbolsToFetch]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchPrices();

    // Set up interval
    const intervalId = setInterval(fetchPrices, interval);

    return () => clearInterval(intervalId);
  }, [enabled, interval, fetchPrices]);

  const getPrice = useCallback((symbol: string): PriceData | undefined => {
    return prices[symbol];
  }, [prices]);

  const getPriceByMint = useCallback((mintAddress: string): PriceData | undefined => {
    const config = COLLATERAL_CONFIGS.find(c => c.mint.toBase58() === mintAddress);
    if (config) {
      return prices[config.symbol];
    }
    return undefined;
  }, [prices]);

  return {
    prices,
    loading,
    error,
    getPrice,
    getPriceByMint,
    refresh: fetchPrices,
  };
}

// Hook for single price with fast refresh
export function usePrice(symbol: string, interval: number = 500) {
  const { prices, loading, error } = usePrices({
    symbols: [symbol],
    interval,
    enabled: !!symbol,
  });

  return {
    price: prices[symbol],
    loading,
    error,
  };
}
