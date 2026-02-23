import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  accent?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  accent = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 border transition-all",
        accent
          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-400"
          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/30",
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "p-3 rounded-xl",
            accent ? "bg-white/20" : "bg-emerald-500/10"
          )}
        >
          <Icon className={cn("h-6 w-6", accent ? "text-white" : "text-emerald-500")} />
        </div>
      </div>
      <p className={cn("text-sm mb-1", accent ? "text-emerald-100" : "text-neutral-500")}>
        {title}
      </p>
      <p className={cn("text-3xl font-bold", accent ? "text-white" : "")}>{value}</p>
      {subtext && (
        <p className={cn("text-xs mt-2", accent ? "text-emerald-100" : "text-neutral-400")}>
          {subtext}
        </p>
      )}
    </div>
  );
}

interface StatBadgeProps {
  label: string;
  value: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function StatBadge({ label, value, variant = "default" }: StatBadgeProps) {
  const colors = {
    default: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <div className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", colors[variant])}>
      {label}: <span className="font-bold">{value}</span>
    </div>
  );
}
