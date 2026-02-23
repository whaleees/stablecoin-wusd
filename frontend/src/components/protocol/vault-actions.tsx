"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  MinusCircle,
  Banknote,
  Undo2,
  AlertCircle,
  CheckCircle2,
  LucideIcon,
} from "lucide-react";

export type VaultAction = "deposit" | "withdraw" | "mint" | "repay";

interface ActionConfig {
  icon: LucideIcon;
  label: string;
  inputLabel: string;
  buttonLabel: string;
  description: string;
  unit: string;
}

export const VAULT_ACTIONS: Record<VaultAction, ActionConfig> = {
  deposit: {
    icon: PlusCircle,
    label: "Deposit",
    inputLabel: "Collateral Amount",
    buttonLabel: "Deposit Collateral",
    description: "Add collateral to increase your borrowing power",
    unit: "Tokens",
  },
  withdraw: {
    icon: MinusCircle,
    label: "Withdraw",
    inputLabel: "Shares to Withdraw",
    buttonLabel: "Withdraw Collateral",
    description: "Remove collateral (maintain safe ratio)",
    unit: "Shares",
  },
  mint: {
    icon: Banknote,
    label: "Mint",
    inputLabel: "WUSD Amount",
    buttonLabel: "Mint WUSD",
    description: "Borrow WUSD against your collateral",
    unit: "WUSD",
  },
  repay: {
    icon: Undo2,
    label: "Repay",
    inputLabel: "WUSD Amount",
    buttonLabel: "Repay Debt",
    description: "Reduce your debt and improve health",
    unit: "WUSD",
  },
};

interface VaultActionTabsProps {
  activeTab: VaultAction;
  onTabChange: (tab: VaultAction) => void;
  className?: string;
}

export function VaultActionTabs({ activeTab, onTabChange, className }: VaultActionTabsProps) {
  const tabs: VaultAction[] = ["deposit", "withdraw", "mint", "repay"];

  return (
    <div className={cn("flex gap-2", className)}>
      {tabs.map((tab) => {
        const config = VAULT_ACTIONS[tab];
        const Icon = config.icon;
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-xl font-medium transition-all",
              isActive
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-sm">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface VaultActionFormProps {
  action: VaultAction;
  amount: string;
  onAmountChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  result?: { success: boolean; message: string } | null;
  className?: string;
}

export function VaultActionForm({
  action,
  amount,
  onAmountChange,
  onSubmit,
  loading = false,
  result,
  className,
}: VaultActionFormProps) {
  const config = VAULT_ACTIONS[action];
  const Icon = config.icon;

  return (
    <div className={cn("bg-white dark:bg-neutral-800 rounded-xl p-6", className)}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Icon className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-semibold">{config.label}</h3>
          <p className="text-xs text-neutral-500">{config.description}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm text-neutral-500 mb-2">
            {config.inputLabel}
          </label>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="text-2xl h-14 pr-20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
              {config.unit}
            </span>
          </div>
        </div>

        <Button
          className="w-full h-12 text-base bg-emerald-500 hover:bg-emerald-600"
          onClick={onSubmit}
          disabled={!amount || loading}
        >
          {loading ? (
            <span className="flex items-center">
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
              Processing...
            </span>
          ) : (
            <>
              <Icon className="h-5 w-5 mr-2" />
              {config.buttonLabel}
            </>
          )}
        </Button>

        {result && (
          <div
            className={cn(
              "p-4 rounded-xl text-sm flex items-start gap-3",
              result.success
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : "bg-red-500/10 text-red-600 border border-red-500/20"
            )}
          >
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            )}
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
