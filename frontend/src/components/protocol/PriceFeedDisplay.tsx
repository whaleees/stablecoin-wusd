"use client";

import { useEffect, useState } from "react";
import { Activity, TrendingUp, Shield, Clock, ExternalLink } from "lucide-react";
import { fetchPythPrice, PYTH_FEED_IDS, PythPrice } from "@/lib/pyth";

export function PriceFeedDisplay() {
  const [priceData, setPriceData] = useState<PythPrice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet") as "mainnet" | "devnet";

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const data = await fetchPythPrice(PYTH_FEED_IDS["SOL/USD"], cluster);
        setPriceData(data);
        setLoading(false);
        setError(null);
      } catch (e) {
        console.error("Failed to fetch Pyth price:", e);
        setError("Failed to fetch price");
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Refresh every 2 seconds for real-time price
    const interval = setInterval(fetchPrice, 2000);
    return () => clearInterval(interval);
  }, [cluster]);

  if (loading) {
    return (
      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-800">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
          <div className="h-4 w-24 bg-neutral-300 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">SOL/USD Oracle</span>
        </div>
        <a
          href="https://pyth.network/price-feeds/crypto-sol-usd"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors"
        >
          <Shield className="h-3 w-3" />
          Pyth Network
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      
      <div className="flex items-baseline gap-2 mb-2">
        <TrendingUp className="h-5 w-5 text-green-500" />
        <span className="text-2xl font-bold">
          ${priceData?.price.toFixed(2)}
        </span>
        <span className="text-sm text-neutral-500">
          ±${priceData?.confidence.toFixed(4)}
        </span>
      </div>
      
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {priceData?.publishTime 
            ? new Date(priceData.publishTime * 1000).toLocaleTimeString()
            : "N/A"
          }
        </div>
        <div className="font-mono">
          {cluster}
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1 text-xs text-purple-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Live price from Pyth Hermes
        </div>
      </div>
    </div>
  );
}
