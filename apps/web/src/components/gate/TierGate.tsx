import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "../ui/Button.js";

type Tier = "FREE" | "PRO" | "PREMIUM";

interface TierGateProps {
  requiredTier: Tier;
  currentTier: Tier;
  children: ReactNode;
}

const order: Record<Tier, number> = {
  FREE: 1,
  PRO: 2,
  PREMIUM: 3,
};

export function TierGate({ requiredTier, currentTier, children }: TierGateProps) {
  const allowed = order[currentTier] >= order[requiredTier];

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {children}
      {!allowed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-bg-primary/70 backdrop-blur-sm">
          <div className="max-w-sm rounded-lg border border-border-base bg-bg-card p-4 text-center">
            <p className="mb-1 text-lg">🔒</p>
            <p className="text-sm font-semibold text-text-primary">
              Upgrade to Pro to unlock AI Query
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Ask natural-language questions about your call data.
            </p>
            <div className="mt-3">
              <Link to="/pricing">
                <Button>Upgrade to Pro</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
