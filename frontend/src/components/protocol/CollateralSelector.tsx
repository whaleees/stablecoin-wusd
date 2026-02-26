"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import Image from "next/image";
import { COLLATERAL_CONFIGS, CollateralConfig } from "@/lib/collateral";
import { fetchPythPrice, PYTH_FEED_IDS, PythPrice } from "@/lib/pyth";

interface CollateralSelectorProps {
  value: CollateralConfig;
  onChange: (config: CollateralConfig) => void;
  className?: string;
}

export function CollateralSelector({ value, onChange, className = "" }: CollateralSelectorProps) {
  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchPrices = async () => {
      const priceMap: Record<string, number> = {};
      
      for (const config of COLLATERAL_CONFIGS) {
        if (config.pythFeedId) {
          const feedKey = `${config.symbol === "wBTC" ? "BTC" : config.symbol === "wETH" ? "ETH" : config.symbol === "wSUI" ? "SUI" : config.symbol}/USD` as keyof typeof PYTH_FEED_IDS;
          const feedId = PYTH_FEED_IDS[feedKey];
          if (feedId) {
            try {
              const data = await fetchPythPrice(feedId, "devnet");
              priceMap[config.symbol] = data.price;
            } catch {
              // ignore
            }
          }
        }
      }
      setPrices(priceMap);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Image
            src={value.image}
            alt={value.symbol}
            width={32}
            height={32}
            className="rounded-full"
          />
          <div className="text-left">
            <div className="font-medium">{value.symbol}</div>
            <div className="text-xs text-neutral-500">{value.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prices[value.symbol] && (
            <span className="text-sm font-mono text-neutral-500">
              ${prices[value.symbol] >= 1000 
                ? prices[value.symbol].toLocaleString(undefined, { maximumFractionDigits: 0 })
                : prices[value.symbol].toFixed(2)
              }
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xl overflow-hidden">
            {COLLATERAL_CONFIGS.map((config) => (
              <button
                key={config.symbol}
                onClick={() => {
                  onChange(config);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={config.image}
                    alt={config.symbol}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                  <div className="text-left">
                    <div className="font-medium">{config.symbol}</div>
                    <div className="text-xs text-neutral-500">
                      {config.name} · {(config.collateralFactor / 100).toFixed(0)}% LTV
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {prices[config.symbol] && (
                    <span className="text-sm font-mono text-neutral-500">
                      ${prices[config.symbol] >= 1000 
                        ? prices[config.symbol].toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : prices[config.symbol].toFixed(2)
                      }
                    </span>
                  )}
                  {value.symbol === config.symbol && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
