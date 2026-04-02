import type { ReactNode } from "react";

type BadgeVariant = "free" | "pro" | "premium" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const badgeClasses: Record<BadgeVariant, string> = {
  free: "bg-slate-700/40 text-slate-200 border-slate-500/40",
  pro: "bg-accent-blue/20 text-blue-300 border-accent-blue/40",
  premium: "bg-accent-purple/20 text-purple-300 border-accent-purple/40",
  neutral: "bg-bg-card2 text-text-secondary border-border-base",
};

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses[variant]}`}
    >
      {children}
    </span>
  );
}
