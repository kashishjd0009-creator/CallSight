import { useNavigate } from "react-router-dom";

import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";

export function PricingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-full p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-xl border border-border-base bg-bg-card p-5">
          <h1 className="text-2xl font-semibold">Pricing</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Choose the tier that matches your call center analytics needs.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card accentColor="#64748b" subtitle="Start for free" title="Free">
            <div className="mb-3 flex items-center justify-between">
              <Badge variant="free">FREE</Badge>
              <span className="text-sm text-text-secondary">$0 / month</span>
            </div>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>• AI Queries: 0 / month</li>
              <li>• Upload limit: 5 MB / 10K rows</li>
              <li>• Auto dashboard + PNG export</li>
            </ul>
            <div className="mt-4">
              <Button className="w-full justify-center" variant="secondary">
                Current plan
              </Button>
            </div>
          </Card>

          <Card accentColor="#3b82f6" subtitle="Best for growing teams" title="Pro">
            <div className="mb-3 flex items-center justify-between">
              <Badge variant="pro">PRO</Badge>
              <span className="text-sm text-text-secondary">$29 / month</span>
            </div>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>• AI Queries: 30 / month</li>
              <li>• Upload limit: 50 MB / 500K rows</li>
              <li>• AI chat, PDF export, query history</li>
            </ul>
            <div className="mt-4">
              <Button className="w-full justify-center">Upgrade to Pro</Button>
            </div>
          </Card>

          <Card accentColor="#8b5cf6" subtitle="For high-volume operations" title="Premium">
            <div className="mb-3 flex items-center justify-between">
              <Badge variant="premium">PREMIUM</Badge>
              <span className="text-sm text-text-secondary">$79 / month</span>
            </div>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>• AI Queries: Unlimited</li>
              <li>• Upload limit: 200 MB</li>
              <li>• Unlimited query history and exports</li>
            </ul>
            <div className="mt-4">
              <Button className="w-full justify-center" variant="secondary">
                Upgrade to Premium
              </Button>
            </div>
          </Card>
        </div>

        <Card accentColor="#10b981" subtitle="Need help deciding?" title="Feature Comparison">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border-base text-left text-text-secondary">
                  <th className="px-2 py-2">Feature</th>
                  <th className="px-2 py-2">Free</th>
                  <th className="px-2 py-2">Pro</th>
                  <th className="px-2 py-2">Premium</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border-base/60">
                  <td className="px-2 py-2">AI Query Chat</td>
                  <td className="px-2 py-2">—</td>
                  <td className="px-2 py-2">30/month</td>
                  <td className="px-2 py-2">Unlimited</td>
                </tr>
                <tr className="border-b border-border-base/60">
                  <td className="px-2 py-2">CSV Upload Size</td>
                  <td className="px-2 py-2">5 MB</td>
                  <td className="px-2 py-2">50 MB</td>
                  <td className="px-2 py-2">200 MB</td>
                </tr>
                <tr>
                  <td className="px-2 py-2">Export Types</td>
                  <td className="px-2 py-2">PNG</td>
                  <td className="px-2 py-2">PNG + PDF</td>
                  <td className="px-2 py-2">PNG + PDF</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={() => navigate("/register")}>
            Create account
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/login")}>
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
