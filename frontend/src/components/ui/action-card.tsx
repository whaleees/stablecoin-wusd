import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  className?: string;
}

export function ActionCard({
  title,
  description,
  href,
  icon: Icon,
  className,
}: ActionCardProps) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "group bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 transition-all cursor-pointer hover:shadow-lg",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
            <Icon className="h-6 w-6 text-emerald-500" />
          </div>
          <ArrowRight className="h-5 w-5 text-neutral-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
        </div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
    </Link>
  );
}
