"use client";

import { useEffect, useState } from "react";
import { Activity, TrendingUp, TrendingDown, Shield, ExternalLink } from "lucide-react";
import Image from "next/image";
import { fetchPythPrice, PYTH_FEED_IDS, PythPrice } from "@/lib/pyth";
import { COLLATERAL_CONFIGS, CollateralConfig } from "@/lib/collateral";

interface PriceItem {
  config: CollateralConfig;
  price: PythPrice | null;
  loading: boolean;
  error: string | null;
  prevPrice?: number;
}

export function MultiPriceDisplay() {
  const [prices, setPrices] = useState<PriceItem[]>(
    COLLATERAL_CONFIGS.map(config => ({
      config,
      price: null,
      loading: true,
      error: null,
    }))
  );

  const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet") as "mainnet" | "devnet";

  useEffect(() => {
    const fetchAllPrices = async () => {
      const updatedPrices = await Promise.all(
        COLLATERAL_CONFIGS.map(async (config) => {
          const currentItem = prices.find(p => p.config.symbol === config.symbol);
          const prevPrice = currentItem?.price?.price;

          if (!config.pythFeedId) {
            // No Pyth feed - show mock price indicator
            return {
              config,
              price: null,
              loading: false,
              error: null,
              prevPrice,
            };
          }

          const feedKey = `${config.symbol === "wBTC" ? "BTC" : config.symbol === "wETH" ? "ETH" : config.symbol === "wSUI" ? "SUI" : config.symbol}/USD` as keyof typeof PYTH_FEED_IDS;
          const feedId = PYTH_FEED_IDS[feedKey];
          
          if (!feedId) {
            return {
              config,
              price: null,
              loading: false,
              error: "No feed",
              prevPrice,
            };
          }

          try {
            const data = await fetchPythPrice(feedId, cluster);
            return {
              config,
              price: data,
              loading: false,
              error: null,
              prevPrice,
            };
          } catch (e) {
            return {
              config,
              price: currentItem?.price || null,
              loading: false,
              error: "Failed to fetch",
              prevPrice,
            };
          }
        })
      );
      setPrices(updatedPrices);
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 5000);
    return () => clearInterval(interval);
  }, [cluster]);

  return (
    <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500 animate-pulse" />
          <span className="text-sm font-medium">Live Prices</span>
        </div>
        <a
          href="https://pyth.network"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors"
        >
          <Shield className="h-3 w-3" />
          Pyth
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="space-y-2">
        {prices.map(({ config, price, loading, error, prevPrice }) => (
          <div
            key={config.symbol}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50"
          >
            <div className="flex items-center gap-2">
              <Image
                src={config.image}
                alt={config.symbol}
                width={24}
                height={24}
                className="rounded-full"
              />
              <div>
                <span className="font-medium text-sm">{config.symbol}</span>
                <span className="text-xs text-neutral-500 ml-1">
                  {(config.collateralFactor / 100).toFixed(0)}% LTV
                </span>
              </div>
            </div>

            <div className="text-right">
              {loading ? (
                <div className="animate-pulse h-5 w-16 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
              ) : error ? (
                <span className="text-xs text-red-500">{error}</span>
              ) : price ? (
                <div className="flex items-center gap-1">
                  {prevPrice !== undefined && price.price !== prevPrice && (
                    price.price > prevPrice ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )
                  )}
                  <span className="font-mono font-medium">
                    ${price.price >= 1000 
                      ? price.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                      : price.price.toFixed(2)
                    }
                  </span>
                </div>
              ) : (
                <span className="text-xs text-neutral-500">Mock price</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Refreshing every 5s
        </div>
      </div>
    </div>
  );
}
