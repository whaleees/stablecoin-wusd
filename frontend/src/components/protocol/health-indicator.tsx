"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

interface HealthIndicatorProps {
  ratio: number;
  className?: string;
}

export function HealthIndicator({ ratio, className }: HealthIndicatorProps) {
  const isHealthy = ratio > 200;
  const isWarning = ratio <= 200 && ratio > 150;
  const isCritical = ratio <= 150;

  const color = isHealthy
    ? "text-emerald-500"
    : isWarning
    ? "text-amber-500"
    : "text-red-500";

  const bgColor = isHealthy
    ? "bg-emerald-500"
    : isWarning
    ? "bg-amber-500"
    : "bg-red-500";

  const Icon = isHealthy ? CheckCircle2 : isWarning ? AlertCircle : AlertTriangle;

  const percentage = Math.min(ratio / 3, 100);

  return (
    <div className={cn("bg-white dark:bg-neutral-800 rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", color)} />
          <span className="font-medium">Health Factor</span>
        </div>
        <span className={cn("text-2xl font-bold", color)}>{ratio.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500", bgColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-neutral-500">
        <span>Liquidation: 100%</span>
        <span>Safe: 200%+</span>
      </div>
    </div>
  );
}

interface HealthBadgeProps {
  ratio: number;
  className?: string;
}

export function HealthBadge({ ratio, className }: HealthBadgeProps) {
  const isHealthy = ratio > 200;
  const isWarning = ratio <= 200 && ratio > 150;

  const colorClass = isHealthy
    ? "bg-emerald-500/10 text-emerald-500"
    : isWarning
    ? "bg-amber-500/10 text-amber-500"
    : "bg-red-500/10 text-red-500";

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colorClass, className)}>
      {ratio.toFixed(0)}% CR
    </span>
  );
}
