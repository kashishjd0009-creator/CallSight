import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  accentColor?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
}

export function Card({ title, subtitle, accentColor = "#3b82f6", rightSlot, children }: CardProps) {
  return (
    <section
      className="rounded-xl border border-border-base bg-bg-card p-4 shadow-card transition-transform duration-200 hover:-translate-y-0.5"
      style={{ borderTopWidth: "2px", borderTopColor: accentColor }}
    >
      {(title || subtitle || rightSlot) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
          </div>
          {rightSlot}
        </header>
      )}
      {children}
    </section>
  );
}
