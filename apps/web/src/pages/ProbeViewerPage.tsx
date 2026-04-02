import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { useAuthSession } from "../contexts/auth-session-context.js";
import { fetchWithAuthRetry } from "../lib/auth-api.js";
import { deepUnwrapJsonStrings } from "../lib/format-probe-payload.js";
import { buildProbeViewerQuery } from "../lib/probe-viewer-query.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type ProbeEventLite = {
  id: string;
  phase: "before" | "after" | "error";
  level: string;
  message?: string | null;
  payload?: unknown;
  durationMs?: number | null;
  statusCode?: number | null;
  errorCode?: string | null;
  createdAt: string;
  userId?: string | null;
};

type ProbeViewerRow = {
  probeSpanId: string;
  correlationId: string;
  userId: string | null;
  step: string;
  createdAt: string;
  before: ProbeEventLite | null;
  after: ProbeEventLite | null;
  error: ProbeEventLite | null;
};

type ProbeViewerResponse = {
  rows: ProbeViewerRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function ProbePayloadView({ value }: { value: unknown }) {
  const unwrapped = useMemo(() => deepUnwrapJsonStrings(value), [value]);
  if (unwrapped === undefined || unwrapped === null) {
    return (
      <p className="mt-2 text-xs text-text-muted">
        (no payload — older rows may lack a before payload)
      </p>
    );
  }
  return <PayloadNode depth={0} value={unwrapped} />;
}

function PayloadNode({ value, depth }: { value: unknown; depth: number }) {
  if (depth > 14) {
    return <span className="text-text-muted">…</span>;
  }
  if (value === null) {
    return <span className="text-text-muted">null</span>;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return <span className="text-text-primary">{String(value)}</span>;
  }
  if (typeof value === "string") {
    return <span className="whitespace-pre-wrap break-words text-text-secondary">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-text-muted">[]</span>;
    }
    return (
      <ol className="mt-1 list-decimal space-y-2 pl-4 text-text-secondary">
        {value.map((item, i) => (
          <li className="pl-1" key={i}>
            <PayloadNode depth={depth + 1} value={item} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-text-muted">{"{}"}</span>;
    }
    return (
      <div className="mt-1 space-y-2 border-l border-border-base pl-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] font-semibold text-text-primary">{k}</div>
            <div className="mt-0.5">
              <PayloadNode depth={depth + 1} value={v} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-text-secondary">{String(value)}</span>;
}

export function ProbeViewerPage() {
  const navigate = useNavigate();
  const { account, canViewProbe } = useAuthSession();
  const [rows, setRows] = useState<ProbeViewerRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [step, setStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const query = useMemo(() => {
    return buildProbeViewerQuery({
      page,
      pageSize,
      sortDir: "desc",
      search: debouncedSearch,
      step,
    });
  }, [page, pageSize, debouncedSearch, step]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setForbidden(false);
    void fetchWithAuthRetry(`${API_URL}/api/v1/probe/events?${query}`)
      .then(async (response) => {
        if (response.status === 403) {
          if (!cancelled) {
            setForbidden(true);
            setRows([]);
          }
          return;
        }
        const body = (await response.json()) as {
          data?: ProbeViewerResponse;
          error?: { message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(body.error?.message ?? "Failed to load probe events.");
        }
        if (!cancelled) {
          setRows(body.data.rows);
          setTotalPages(body.data.totalPages);
          setTotal(body.data.total);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load probe events.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (forbidden) {
      navigate("/dashboard", { replace: true });
    }
  }, [forbidden, navigate]);

  const steps = [...new Set(rows.map((row) => row.step))];

  return (
    <AppShell accountTier={account.tier} canViewProbe={canViewProbe}>
      <div className="min-h-screen p-4 md:p-6">
        <div className="mx-auto max-w-[1280px] space-y-4">
          <header className="rounded-xl border border-border-base bg-bg-card px-4 py-3">
            <h2 className="text-lg font-semibold text-text-primary">Probe Viewer</h2>
            <p className="text-xs text-text-secondary">
              Admin-only pipeline log viewer (read-only)
            </p>
          </header>

          <Card accentColor="#3b82f6" subtitle={`Total spans: ${total}`} title="Controls">
            <div className="grid gap-2 md:grid-cols-4">
              <input
                className="rounded-lg border border-border-base bg-bg-card2 px-3 py-2 text-sm"
                onChange={(e) => {
                  setPage(1);
                  setSearchInput(e.target.value);
                }}
                placeholder="Search correlation id, user id, step, path, message…"
                value={searchInput}
              />
              <select
                className="rounded-lg border border-border-base bg-bg-card2 px-3 py-2 text-sm"
                onChange={(e) => {
                  setPage(1);
                  setStep(e.target.value);
                }}
                value={step}
              >
                <option value="">All steps</option>
                {steps.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => {
                  setPage(1);
                  setSearchInput("");
                  setDebouncedSearch("");
                  setStep("");
                }}
                type="button"
                variant="ghost"
              >
                Reset
              </Button>
              <div className="flex items-center justify-end gap-2 text-xs text-text-secondary">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  type="button"
                  variant="secondary"
                >
                  Prev
                </Button>
                <span>
                  Page {page} / {totalPages}
                </span>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  type="button"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>

          {error ? (
            <Card accentColor="#ef4444" subtitle="Probe query failed" title="Error">
              <p className="text-sm text-accent-red">{error}</p>
            </Card>
          ) : null}
          {loading ? (
            <Card accentColor="#3b82f6" subtitle="Reading events..." title="Loading">
              <p className="text-sm text-text-secondary">Please wait…</p>
            </Card>
          ) : null}

          <div className="space-y-3">
            {rows.map((row) => (
              <section
                className="rounded-xl border border-border-base bg-bg-card p-3"
                key={row.probeSpanId}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-text-muted">
                    <span className="mr-2 rounded border border-border-base bg-bg-card2 px-2 py-1">
                      {row.step}
                    </span>
                    <span>{new Date(row.createdAt).toLocaleString()}</span>
                    {row.userId ? (
                      <span className="ml-2 rounded border border-border-base bg-bg-card2 px-2 py-1 font-mono text-[10px] text-text-secondary">
                        user {row.userId}
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] text-text-muted">user —</span>
                    )}
                  </div>
                  {row.error ? (
                    <span className="rounded border border-accent-red/50 bg-accent-red/10 px-2 py-1 text-[10px] uppercase text-accent-red">
                      Error phase present
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <details className="rounded-lg border border-border-base bg-bg-card2 p-2">
                    <summary className="cursor-pointer text-xs font-semibold text-text-primary">
                      Before
                      {row.before?.userId != null && row.before.userId !== "" ? (
                        <span className="ml-2 font-mono text-[10px] font-normal text-text-muted">
                          ({row.before.userId})
                        </span>
                      ) : null}
                    </summary>
                    <div className="mt-2 max-h-80 overflow-auto text-xs">
                      <ProbePayloadView value={row.before?.payload} />
                    </div>
                  </details>
                  <div className="rounded-lg border border-border-base bg-bg-card2 p-2 text-xs text-text-secondary">
                    <p className="font-semibold text-text-primary">Process</p>
                    <p className="mt-1">{row.step}</p>
                    <p className="mt-1">Correlation: {row.correlationId}</p>
                    <p className="mt-1">Span: {row.probeSpanId}</p>
                    <p className="mt-1 break-all">
                      User id:{" "}
                      <span className="font-mono text-text-primary">{row.userId ?? "—"}</span>
                    </p>
                  </div>
                  <details className="rounded-lg border border-border-base bg-bg-card2 p-2">
                    <summary className="cursor-pointer text-xs font-semibold text-text-primary">
                      After
                      {row.after?.userId != null && row.after.userId !== "" ? (
                        <span className="ml-2 font-mono text-[10px] font-normal text-text-muted">
                          ({row.after.userId})
                        </span>
                      ) : null}
                    </summary>
                    <div className="mt-2 max-h-80 overflow-auto text-xs">
                      <ProbePayloadView value={row.after?.payload} />
                    </div>
                    {row.error ? (
                      <>
                        <p className="mt-2 text-xs font-semibold text-accent-red">
                          Error
                          {row.error.userId != null && row.error.userId !== "" ? (
                            <span className="ml-2 font-mono text-[10px] font-normal text-text-muted">
                              ({row.error.userId})
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1 max-h-48 overflow-auto text-xs">
                          <ProbePayloadView value={row.error.payload} />
                        </div>
                      </>
                    ) : null}
                  </details>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
