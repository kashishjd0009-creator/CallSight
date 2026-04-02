import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { LogoutButton } from "../auth/LogoutButton.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { buildSidebarNavItems, sidebarHeaderSubtitle } from "../../lib/app-nav.js";
import { SidebarToggleIcon } from "./SidebarToggleIcon.js";

export type AppShellTier = "FREE" | "PRO" | "PREMIUM";

export type AppShellProps = {
  children: ReactNode;
  accountTier: AppShellTier | null;
  /** When true, Probe Viewer appears in the nav (same probe API check as Dashboard). */
  canViewProbe: boolean;
  /** Only Dashboard passes the analytics filter block; other pages omit this. */
  filtersSlot?: ReactNode;
};

export function AppShell({ children, accountTier, canViewProbe, filtersSlot }: AppShellProps) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const hasFilters = Boolean(filtersSlot);
  const navItems = buildSidebarNavItems(canViewProbe);
  const subtitle = sidebarHeaderSubtitle(hasFilters);

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden border-r border-border-base bg-bg-card transition-[width] duration-200 ease-out ${
          isSidebarOpen ? "w-[280px]" : "w-14"
        }`}
      >
        {isSidebarOpen ? (
          <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border-base p-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-blue font-bold text-white">
              CS
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">CallSight</p>
              <p className="truncate text-[10px] text-text-muted">{subtitle}</p>
            </div>
            <button
              aria-expanded
              aria-label="Collapse navigation"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-base bg-bg-card2 text-text-secondary hover:text-text-primary"
              onClick={() => setIsSidebarOpen(false)}
              type="button"
            >
              <SidebarToggleIcon expanded />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-center gap-2 border-b border-border-base p-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-blue font-bold text-white">
              CS
            </span>
            <button
              aria-expanded={false}
              aria-label="Expand navigation"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-base bg-bg-card2 text-text-secondary hover:text-text-primary"
              onClick={() => setIsSidebarOpen(true)}
              type="button"
            >
              <SidebarToggleIcon expanded={false} />
            </button>
          </div>
        )}

        {isSidebarOpen ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-3">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Button
                  className="w-full justify-start"
                  key={item.id}
                  onClick={() => navigate(item.to)}
                  type="button"
                  variant="secondary"
                >
                  {item.label}
                </Button>
              ))}
              <div className="flex items-center justify-between gap-2">
                <LogoutButton />
                {accountTier === null ? (
                  <span className="text-xs text-text-muted">…</span>
                ) : (
                  <Badge
                    variant={
                      accountTier === "FREE" ? "free" : accountTier === "PRO" ? "pro" : "premium"
                    }
                  >
                    {accountTier}
                  </Badge>
                )}
              </div>
            </nav>
            {filtersSlot ?? null}
          </div>
        ) : null}
      </aside>

      <main
        className={`min-h-screen min-w-0 transition-[padding-left] duration-200 ease-out ${
          isSidebarOpen ? "pl-[280px]" : "pl-14"
        }`}
      >
        {children}
      </main>
    </>
  );
}
