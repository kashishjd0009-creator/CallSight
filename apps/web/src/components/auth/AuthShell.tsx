import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthShellProps {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <main className="min-h-full bg-bg-primary p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-md rounded-xl border border-border-base bg-bg-card p-6 shadow-card">
          <header className="mb-6 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-blue font-bold text-white">
              CS
            </span>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
              <p className="text-xs text-text-secondary">{subtitle}</p>
            </div>
          </header>

          {children}

          <footer className="mt-5 border-t border-border-base pt-4 text-sm text-text-secondary">
            {footer}
          </footer>
          <div className="mt-3 text-center">
            <Link className="text-xs text-text-muted hover:text-text-secondary" to="/pricing">
              View pricing
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
