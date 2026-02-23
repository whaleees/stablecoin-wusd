import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = AlertTriangle,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-12 border border-neutral-200 dark:border-neutral-800 text-center",
        className
      )}
    >
      <Icon className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-neutral-500 mb-6">{description}</p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link href={actionHref}>
            <Button>{actionLabel}</Button>
          </Link>
        ) : (
          <Button onClick={onAction}>{actionLabel}</Button>
        )
      )}
    </div>
  );
}

interface WarningStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function WarningState({
  icon: Icon = AlertTriangle,
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: WarningStateProps) {
  return (
    <div
      className={cn(
        "max-w-2xl mx-auto text-center py-20",
        className
      )}
    >
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-8">
        <Icon className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <p className="text-neutral-500 mb-6">{description}</p>
        {actionLabel && actionHref && (
          <Link href={actionHref}>
            <Button>{actionLabel}</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
