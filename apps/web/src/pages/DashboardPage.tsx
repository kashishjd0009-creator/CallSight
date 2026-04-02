import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "../components/layout/AppShell.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { TierGate } from "../components/gate/TierGate.js";
import { QueryPanel } from "../components/query/QueryPanel.js";
import {
  buildAgentLeaderboardQueryString,
  LEADERBOARD_SORT_COLUMNS,
} from "../lib/agent-leaderboard-query.js";
import { useAuthSession } from "../contexts/auth-session-context.js";
import { fetchWithAuthRetry } from "../lib/auth-api.js";
import { userMessageFromApiError } from "../lib/map-api-error.js";

type DashboardPayload = {
  meta: {
    queues: string[];
    agents: string[];
    reportingTimeZone?: string;
  };
  kpis: {
    totalCalls: number;
    avgHandleTime: number;
    serviceLevel: number;
    peakHour: string;
    agentCount: number;
    answerRate: number;
    abandonedCalls: number;
    longCalls5m: number;
  };
  charts: {
    hourlyCallVolume: Array<{ hour: string; calls: number }>;
    queueDistribution: Array<{ queue: string; calls: number }>;
    talkTimeHistogram: Array<{ bucket: string; calls: number }>;
    avgTalkByHour: Array<{ hour: string; avgTalk: number }>;
    waitTimeByHour: Array<{ hour: string; avgWait: number }>;
    agentPerformance: Array<{
      agentName: string;
      calls: number;
      totalTalk: number;
      avgTalk: number;
      avgWait: number;
      sharePct: number;
      shortCalls: number;
      extraLongCalls: number;
    }>;
    agentHourHeatmap: Array<{ agent: string; hour: number; count: number }>;
    hourlyDispositionStack: Array<{
      hour: string;
      answered: number;
      abandoned: number;
      forwarded: number;
      other: number;
    }>;
    dispositionBreakdown?: Array<{ disposition: string; calls: number }>;
  };
  intelligence: {
    repeatCallerSummary: {
      totalRepeatCallers: number;
      totalRepeatCalls: number;
      topRepeatCallers: Array<{ callerPhone: string; calls: number }>;
    };
    recommendation: string;
  };
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const ACCENTS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

/** Reference-aligned semantic colors for disposition stacks */
const DISP_COLORS = {
  answered: "#26a69a",
  forwarded: "#ffa726",
  abandoned: "#ef5350",
  other: "#64748b",
} as const;

/** Aligned with `COMPARE_MEASURES` / compare API (`apps/api/.../compare-metrics.ts`). */
const COMPARE_MEASURE_OPTIONS = [
  { id: "total_calls", label: "Total calls" },
  { id: "total_talk_time", label: "Total talk time (s)" },
  { id: "total_wait_time", label: "Total wait time (s)" },
  { id: "avg_talk_time", label: "Avg talk time (s)" },
  { id: "avg_wait_time", label: "Avg wait time (s)" },
  { id: "aht", label: "AHT (s)" },
  { id: "service_level_pct", label: "Service level % (≤20s wait)" },
  { id: "short_call_rate", label: "Short-call rate % (<30s)" },
  { id: "long_call_rate", label: "Long-call rate % (≥300s)" },
  { id: "abandonment_rate", label: "Abandonment rate %" },
  { id: "answer_rate", label: "Answer rate %" },
  { id: "transfer_rate", label: "Transfer rate %" },
] as const;

type CompareMeasureId = (typeof COMPARE_MEASURE_OPTIONS)[number]["id"];

type CompareScalarApi = {
  mode: "scalar";
  chartHint: "bar";
  measure: string;
  measureLabel: string;
  points: { name: string; value: number }[];
};

type CompareTimeSeriesApi = {
  mode: "time_series";
  chartHint: "line";
  column: string;
  bucket: string;
  series: { name: string; points: { bucketKey: string; label: string; value: number }[] }[];
};

const TS_COLUMN_OPTIONS = [
  { id: "talkTime", label: "Talk time (s)" },
  { id: "waitTime", label: "Wait time (s)" },
  { id: "holdTime", label: "Hold time (s)" },
  { id: "wrapUpTime", label: "Wrap-up time (s)" },
] as const;

type TsColumnId = (typeof TS_COLUMN_OPTIONS)[number]["id"];

/** Align series to one row per time bucket for Recharts multi-line. */
function mergeTimeSeriesForLines(series: CompareTimeSeriesApi["series"]): {
  rows: Record<string, string | number | null>[];
  lineKeys: string[];
} {
  const keys = new Set<string>();
  for (const s of series) {
    for (const p of s.points) {
      keys.add(p.bucketKey);
    }
  }
  const order = [...keys].sort();
  const lineKeys = series.map((s, i) => `__s${i}_${s.name.replace(/\W+/g, "_")}`);
  const rows = order.map((bk) => {
    const row: Record<string, string | number | null> = { bucketKey: bk };
    series.forEach((s, i) => {
      const pt = s.points.find((p) => p.bucketKey === bk);
      row[lineKeys[i] ?? `__s${i}`] = pt?.value ?? null;
    });
    return row;
  });
  return { rows, lineKeys };
}

const CHART_AXIS = "#6b8caa";
const CHART_GRID = "rgba(28, 42, 58, 0.45)";

const FILTER_SECTION_LABEL =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-400/90";
const FILTER_FIELD_BOX =
  "rounded-md border border-border-base bg-bg-card2 px-2.5 py-1.5 shadow-sm shadow-black/20";
const FILTER_INNER_HINT =
  "mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-text-muted";

type DashboardSectionProps = {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  accentBorder?: string;
  children: ReactNode;
};

function DashboardSection({
  title,
  subtitle,
  badge,
  accentBorder = "border-accent-blue/25 bg-accent-blue/10",
  children,
}: DashboardSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border-base pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={`mt-0.5 h-7 w-7 shrink-0 rounded-md border ${accentBorder}`}
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-text-primary">{title}</h2>
            <p className="mt-0.5 text-xs leading-snug text-text-muted">{subtitle}</p>
          </div>
        </div>
        {badge ? <div className="shrink-0 text-xs">{badge}</div> : null}
      </div>
      {children}
    </section>
  );
}

function formatDispositionTooltipLabel(name: string | undefined): string {
  if (name === "answered") {
    return "Answered";
  }
  if (name === "abandoned") {
    return "Abandoned";
  }
  if (name === "forwarded") {
    return "Forwarded";
  }
  if (name === "other") {
    return "Other / unknown";
  }
  return name ?? "";
}

type TooltipPayloadItem = { dataKey?: string | number; value?: number | string };

function DispositionHourTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const total = payload.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return (
    <div className="rounded-lg border border-border-base bg-bg-card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-text-primary">{label}</p>
      <p className="mt-0.5 text-text-muted">Total calls · {total}</p>
      <ul className="mt-2 space-y-1 border-t border-border-base/80 pt-2">
        {payload
          .filter((p) => Number(p.value) > 0)
          .map((p) => (
            <li className="flex justify-between gap-6 text-text-secondary" key={String(p.dataKey)}>
              <span>{formatDispositionTooltipLabel(String(p.dataKey))}</span>
              <span className="font-medium tabular-nums text-text-primary">{p.value}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const uploadId = searchParams.get("uploadId") ?? "";
  const { account, canViewProbe } = useAuthSession();
  const [queueFilter, setQueueFilter] = useState("ALL");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [dispositionFilter, setDispositionFilter] = useState("ALL");
  const [hourFrom, setHourFrom] = useState(0);
  const [hourTo, setHourTo] = useState(23);
  const [minTalkTime, setMinTalkTime] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [compareAgents, setCompareAgents] = useState<string[]>([]);
  const [compareQueues, setCompareQueues] = useState<string[]>([]);
  const [agentCompareMeasure, setAgentCompareMeasure] = useState<CompareMeasureId>("avg_talk_time");
  const [queueCompareMeasure, setQueueCompareMeasure] = useState<CompareMeasureId>("total_calls");
  const [agentCompareMode, setAgentCompareMode] = useState<"scalar" | "time_series">("scalar");
  const [queueCompareMode, setQueueCompareMode] = useState<"scalar" | "time_series">("scalar");
  const [agentTsColumn, setAgentTsColumn] = useState<TsColumnId>("talkTime");
  const [agentTsBucket, setAgentTsBucket] = useState<"hour" | "day">("hour");
  const [queueTsColumn, setQueueTsColumn] = useState<TsColumnId>("talkTime");
  const [queueTsBucket, setQueueTsBucket] = useState<"hour" | "day">("hour");
  const [agentScalarData, setAgentScalarData] = useState<CompareScalarApi | null>(null);
  const [queueScalarData, setQueueScalarData] = useState<CompareScalarApi | null>(null);
  const [agentTsData, setAgentTsData] = useState<CompareTimeSeriesApi | null>(null);
  const [queueTsData, setQueueTsData] = useState<CompareTimeSeriesApi | null>(null);
  const [agentCompareLoading, setAgentCompareLoading] = useState(false);
  const [queueCompareLoading, setQueueCompareLoading] = useState(false);
  const [agentCompareError, setAgentCompareError] = useState("");
  const [queueCompareError, setQueueCompareError] = useState("");

  const [leaderboardRows, setLeaderboardRows] = useState<
    DashboardPayload["charts"]["agentPerformance"] | null
  >(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [leaderboardSortBy, setLeaderboardSortBy] = useState("calls");
  const [leaderboardOrder, setLeaderboardOrder] = useState<"asc" | "desc">("desc");

  const analyticsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (queueFilter !== "ALL") {
      params.set("queue", queueFilter);
    }
    if (agentFilter !== "ALL") {
      params.set("agent", agentFilter);
    }
    if (dispositionFilter !== "ALL") {
      params.set("disposition", dispositionFilter.toLowerCase());
    }
    if (minTalkTime > 0) {
      params.set("minTalkTime", String(minTalkTime));
    }
    params.set("hourFrom", String(hourFrom));
    params.set("hourTo", String(hourTo));
    return params.toString();
  }, [queueFilter, agentFilter, dispositionFilter, minTalkTime, hourFrom, hourTo]);

  useEffect(() => {
    if (!uploadId) {
      setDashboard(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    const qs = analyticsQueryString;
    const url = `${API_URL}/api/v1/analytics/${uploadId}/dashboard${qs ? `?${qs}` : ""}`;

    void fetchWithAuthRetry(url)
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: DashboardPayload;
          error?: { code?: string; message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(
            userMessageFromApiError(
              response.status,
              body.error,
              "Failed to load dashboard. Please try again.",
            ),
          );
        }
        if (!cancelled) {
          setDashboard(body.data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDashboard(null);
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
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
  }, [uploadId, analyticsQueryString]);

  useEffect(() => {
    if (!uploadId) {
      setLeaderboardRows(null);
      setLeaderboardError("");
      return;
    }
    let cancelled = false;
    setLeaderboardLoading(true);
    setLeaderboardError("");
    const qs = buildAgentLeaderboardQueryString(
      analyticsQueryString,
      leaderboardSortBy,
      leaderboardOrder,
    );
    const url = `${API_URL}/api/v1/analytics/${uploadId}/agents${qs ? `?${qs}` : ""}`;
    void fetchWithAuthRetry(url)
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: DashboardPayload["charts"]["agentPerformance"];
          error?: { code?: string; message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(
            userMessageFromApiError(
              response.status,
              body.error,
              "Failed to load agent leaderboard.",
            ),
          );
        }
        if (!cancelled) {
          setLeaderboardRows(body.data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLeaderboardRows(null);
          setLeaderboardError(e instanceof Error ? e.message : "Failed to load agent leaderboard.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uploadId, analyticsQueryString, leaderboardSortBy, leaderboardOrder]);

  useEffect(() => {
    if (!uploadId || compareAgents.length < 2 || agentCompareMode !== "scalar") {
      setAgentScalarData(null);
      return;
    }
    let cancelled = false;
    setAgentCompareLoading(true);
    setAgentCompareError("");
    const qs = analyticsQueryString;
    const url = `${API_URL}/api/v1/analytics/${uploadId}/compare${qs ? `?${qs}` : ""}`;
    void fetchWithAuthRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "scalar",
        dimension: "agent",
        names: compareAgents,
        measure: agentCompareMeasure,
      }),
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: CompareScalarApi;
          error?: { code?: string; message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(
            userMessageFromApiError(
              response.status,
              body.error,
              "Comparison failed. Please try again.",
            ),
          );
        }
        if (!cancelled) {
          setAgentScalarData(body.data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setAgentScalarData(null);
          setAgentCompareError(e instanceof Error ? e.message : "Comparison failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAgentCompareLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uploadId, analyticsQueryString, compareAgents, agentCompareMeasure, agentCompareMode]);

  useEffect(() => {
    if (!uploadId || compareAgents.length < 2 || agentCompareMode !== "time_series") {
      setAgentTsData(null);
      return;
    }
    let cancelled = false;
    setAgentCompareLoading(true);
    setAgentCompareError("");
    const qs = analyticsQueryString;
    const url = `${API_URL}/api/v1/analytics/${uploadId}/compare${qs ? `?${qs}` : ""}`;
    void fetchWithAuthRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "time_series",
        dimension: "agent",
        names: compareAgents,
        column: agentTsColumn,
        bucket: agentTsBucket,
      }),
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: CompareTimeSeriesApi;
          error?: { code?: string; message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(
            userMessageFromApiError(
              response.status,
              body.error,
              "Comparison failed. Please try again.",
            ),
          );
        }
        if (!cancelled) {
          setAgentTsData(body.data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setAgentTsData(null);
          setAgentCompareError(e instanceof Error ? e.message : "Comparison failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAgentCompareLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    uploadId,
    analyticsQueryString,
    compareAgents,
    agentCompareMode,
    agentTsColumn,
    agentTsBucket,
  ]);

  useEffect(() => {
    if (!uploadId || compareQueues.length < 2 || queueCompareMode !== "scalar") {
      setQueueScalarData(null);
      return;
    }
    let cancelled = false;
    setQueueCompareLoading(true);
    setQueueCompareError("");
    const qs = analyticsQueryString;
    const url = `${API_URL}/api/v1/analytics/${uploadId}/compare${qs ? `?${qs}` : ""}`;
    void fetchWithAuthRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "scalar",
        dimension: "queue",
        names: compareQueues,
        measure: queueCompareMeasure,
      }),
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: CompareScalarApi;
          error?: { code?: string; message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(
            userMessageFromApiError(
              response.status,
              body.error,
              "Comparison failed. Please try again.",
            ),
          );
        }
        if (!cancelled) {
          setQueueScalarData(body.data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setQueueScalarData(null);
          setQueueCompareError(e instanceof Error ? e.message : "Comparison failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQueueCompareLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uploadId, analyticsQueryString, compareQueues, queueCompareMeasure, queueCompareMode]);

  useEffect(() => {
    if (!uploadId || compareQueues.length < 2 || queueCompareMode !== "time_series") {
      setQueueTsData(null);
      return;
    }
    let cancelled = false;
    setQueueCompareLoading(true);
    setQueueCompareError("");
    const qs = analyticsQueryString;
    const url = `${API_URL}/api/v1/analytics/${uploadId}/compare${qs ? `?${qs}` : ""}`;
    void fetchWithAuthRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "time_series",
        dimension: "queue",
        names: compareQueues,
        column: queueTsColumn,
        bucket: queueTsBucket,
      }),
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: CompareTimeSeriesApi;
          error?: { code?: string; message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(
            userMessageFromApiError(
              response.status,
              body.error,
              "Comparison failed. Please try again.",
            ),
          );
        }
        if (!cancelled) {
          setQueueTsData(body.data);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setQueueTsData(null);
          setQueueCompareError(e instanceof Error ? e.message : "Comparison failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQueueCompareLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    uploadId,
    analyticsQueryString,
    compareQueues,
    queueCompareMode,
    queueTsColumn,
    queueTsBucket,
  ]);

  const heatmapRows = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const agents = [...dashboard.charts.agentPerformance]
      .sort((a, b) => b.calls - a.calls)
      .map((row) => row.agentName);
    const matrix = new Map<string, number>();
    for (const point of dashboard.charts.agentHourHeatmap) {
      matrix.set(`${point.agent}:${point.hour}`, point.count);
    }
    const maxCount = Math.max(...dashboard.charts.agentHourHeatmap.map((p) => p.count), 1);

    return agents.map((agent) => ({
      agent,
      cells: Array.from({ length: 24 }, (_, hour) => {
        const count = matrix.get(`${agent}:${hour}`) ?? 0;
        const intensity = count > 0 ? Math.max(0.15, count / maxCount) : 0;
        return { hour, count, intensity };
      }),
    }));
  }, [dashboard]);

  const agentTimeSeriesChart = useMemo(() => {
    if (!agentTsData?.series.length) {
      return null;
    }
    return mergeTimeSeriesForLines(agentTsData.series);
  }, [agentTsData]);

  const queueTimeSeriesChart = useMemo(() => {
    if (!queueTsData?.series.length) {
      return null;
    }
    return mergeTimeSeriesForLines(queueTsData.series);
  }, [queueTsData]);

  const toggleCompareAgent = (name: string) => {
    setCompareAgents((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };
  const toggleCompareQueue = (name: string) => {
    setCompareQueues((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };

  const dashboardFiltersSlot = (
    <div className="border-t border-border-base pt-3">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-text-primary">Filters</h2>
        <p className="text-xs leading-snug text-text-muted">
          Applied on the server to your uploaded rows
        </p>
      </div>
      <div className="space-y-2">
        <select
          className="w-full rounded-lg border border-border-base bg-bg-card2 px-2 py-2 text-sm"
          disabled={!uploadId}
          onChange={(e) => setQueueFilter(e.target.value)}
          value={queueFilter}
        >
          <option value="ALL">All queues</option>
          {(dashboard?.meta.queues ?? []).map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-lg border border-border-base bg-bg-card2 px-2 py-2 text-sm"
          disabled={!uploadId}
          onChange={(e) => setAgentFilter(e.target.value)}
          value={agentFilter}
        >
          <option value="ALL">All agents</option>
          {(dashboard?.meta.agents ?? []).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-lg border border-border-base bg-bg-card2 px-2 py-2 text-sm"
          disabled={!uploadId}
          onChange={(e) => setDispositionFilter(e.target.value)}
          value={dispositionFilter}
        >
          <option value="ALL">All dispositions</option>
          <option value="answered">Answered</option>
          <option value="abandoned">Abandoned</option>
          <option value="forwarded">Forwarded</option>
        </select>
        <div>
          <span className={FILTER_SECTION_LABEL}>Hour range</span>
          <div className="grid grid-cols-2 gap-2">
            <div className={FILTER_FIELD_BOX}>
              <span className={FILTER_INNER_HINT}>From</span>
              <input
                aria-label="Hour from"
                className="w-full border-0 bg-transparent p-0 text-sm tabular-nums text-text-primary outline-none ring-0 placeholder:text-text-muted focus:ring-0 disabled:opacity-50"
                disabled={!uploadId}
                max={23}
                min={0}
                onChange={(e) => setHourFrom(Number(e.target.value))}
                placeholder="From"
                type="number"
                value={hourFrom}
              />
            </div>
            <div className={FILTER_FIELD_BOX}>
              <span className={FILTER_INNER_HINT}>To</span>
              <input
                aria-label="Hour to"
                className="w-full border-0 bg-transparent p-0 text-sm tabular-nums text-text-primary outline-none ring-0 placeholder:text-text-muted focus:ring-0 disabled:opacity-50"
                disabled={!uploadId}
                max={23}
                min={0}
                onChange={(e) => setHourTo(Number(e.target.value))}
                placeholder="To"
                type="number"
                value={hourTo}
              />
            </div>
          </div>
        </div>
        <div>
          <span className={FILTER_SECTION_LABEL}>Min talk time</span>
          <select
            className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
            disabled={!uploadId}
            onChange={(e) => setMinTalkTime(Number(e.target.value))}
            value={minTalkTime}
          >
            <option value={0}>Any Duration</option>
            <option value={30}>≥ 30s</option>
            <option value={60}>≥ 1m</option>
            <option value={120}>≥ 2m</option>
            <option value={300}>≥ 5m</option>
          </select>
        </div>
        <Button
          disabled={!uploadId}
          onClick={() => {
            setQueueFilter("ALL");
            setAgentFilter("ALL");
            setDispositionFilter("ALL");
            setHourFrom(0);
            setHourTo(23);
            setMinTalkTime(0);
          }}
          variant="ghost"
        >
          Reset filters
        </Button>
        <div className="text-xs text-text-secondary">
          {dashboard ? `${dashboard.kpis.totalCalls} rows (filtered)` : "—"}
        </div>
        <p className="text-xs text-text-muted">
          Hour filter uses hour-of-day in the reporting timezone (
          {dashboard?.meta.reportingTimeZone ?? "UTC"}) from each row&apos;s timestamp (rows without
          a time are excluded when filtering by hour).
        </p>
      </div>
    </div>
  );

  return (
    <AppShell
      accountTier={account.tier}
      canViewProbe={canViewProbe}
      filtersSlot={dashboardFiltersSlot}
    >
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-[1280px] space-y-4">
          <header className="rounded-xl border border-border-base bg-bg-card px-4 py-3">
            <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
            <p className="text-xs text-text-secondary">
              Real analytics from uploaded CSV · use the left menu for filters and navigation
            </p>
          </header>

          {!uploadId && (
            <Card accentColor="#3b82f6" subtitle="No upload selected" title="Upload Required">
              <p className="text-sm text-text-secondary">
                Open dashboard using an uploaded file: upload on the Upload page, then click "View
                Dashboard".
              </p>
            </Card>
          )}

          {error && (
            <Card accentColor="#ef4444" subtitle="Could not compute analytics" title="Error">
              <p className="text-sm text-accent-red">{error}</p>
            </Card>
          )}

          {loading && (
            <Card
              accentColor="#3b82f6"
              subtitle="Reading uploaded CSV and computing charts"
              title="Loading"
            >
              <p className="text-sm text-text-secondary">Please wait…</p>
            </Card>
          )}

          {dashboard && (
            <>
              <DashboardSection
                badge={
                  <span className="rounded-md border border-border-base bg-bg-card2 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    Peak · {dashboard.kpis.peakHour}
                  </span>
                }
                subtitle="Headline KPIs for the current filter slice from your uploaded call rows."
                title="Overview"
              >
                <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <Card accentColor="#3b82f6" subtitle="Total parsed rows" title="Total Calls">
                    <p className="text-2xl font-bold">{dashboard.kpis.totalCalls}</p>
                  </Card>
                  <Card accentColor="#10b981" subtitle="Answered / total calls" title="Answer Rate">
                    <p className="text-2xl font-bold">{dashboard.kpis.answerRate}%</p>
                  </Card>
                  <Card accentColor="#ef4444" subtitle="Calls not answered" title="Abandoned">
                    <p className="text-2xl font-bold">{dashboard.kpis.abandonedCalls}</p>
                  </Card>
                  <Card accentColor="#10b981" subtitle="Average handle/talk time" title="AHT">
                    <p className="text-2xl font-bold">{dashboard.kpis.avgHandleTime}s</p>
                  </Card>
                  <Card
                    accentColor="#8b5cf6"
                    subtitle="Unique agents in current scope"
                    title="Active Agents"
                  >
                    <p className="text-2xl font-bold">{dashboard.kpis.agentCount}</p>
                  </Card>
                  <Card
                    accentColor="#f59e0b"
                    subtitle="Talk time >= 5 minutes"
                    title="Long Calls (5m+)"
                  >
                    <p className="text-2xl font-bold">{dashboard.kpis.longCalls5m}</p>
                  </Card>
                </section>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-indigo-500/20 bg-indigo-500/[0.07]"
                subtitle="Repeat-caller exposure and a concise staffing readout from the same filtered dataset."
                title="Intelligence"
              >
                <section className="grid gap-4 lg:grid-cols-2">
                  <Card
                    accentColor="#8b5cf6"
                    subtitle="High-frequency caller patterns"
                    title="Repeat caller intelligence"
                  >
                    <div className="space-y-2 text-sm">
                      <p className="text-text-secondary">
                        Repeat callers:{" "}
                        <span className="font-semibold text-text-primary">
                          {dashboard.intelligence.repeatCallerSummary.totalRepeatCallers}
                        </span>
                      </p>
                      <p className="text-text-secondary">
                        Repeat calls:{" "}
                        <span className="font-semibold text-text-primary">
                          {dashboard.intelligence.repeatCallerSummary.totalRepeatCalls}
                        </span>
                      </p>
                      <div className="rounded-lg border border-border-base bg-bg-card2 p-2">
                        {(dashboard.intelligence.repeatCallerSummary.topRepeatCallers.length > 0
                          ? dashboard.intelligence.repeatCallerSummary.topRepeatCallers
                          : [{ callerPhone: "No repeat callers in this slice", calls: 0 }]
                        ).map((row) => (
                          <div
                            className="flex items-center justify-between py-1 text-xs"
                            key={row.callerPhone}
                          >
                            <span className="text-text-secondary">{row.callerPhone}</span>
                            <span className="text-text-primary">
                              {row.calls > 0 ? `${row.calls} calls` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                  <Card
                    accentColor="#f59e0b"
                    subtitle="From abandonment pattern & peak hour"
                    title="Ops recommendation"
                  >
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {dashboard.intelligence.recommendation}
                    </p>
                    <p className="mt-3 text-xs text-text-muted">
                      Peak hour: {dashboard.kpis.peakHour}
                    </p>
                    <p className="text-xs text-text-muted">
                      Service level: {dashboard.kpis.serviceLevel}%
                    </p>
                  </Card>
                </section>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-emerald-500/20 bg-emerald-500/[0.07]"
                badge={
                  <span className="rounded-md border border-border-base bg-bg-card2 px-2 py-1 text-[10px] text-text-secondary">
                    Hover bars · total = hourly volume
                  </span>
                }
                subtitle="Single hourly view: stack segments are dispositions; bar height is total calls that hour. “Other / unknown” covers empty or non-standard disposition values."
                title="Call volume & disposition"
              >
                <Card
                  accentColor="#26a69a"
                  subtitle="Stacked by outcome · includes other / unknown"
                  title="Disposition by hour"
                >
                  <div className="h-80">
                    <ResponsiveContainer height="100%" width="100%">
                      <BarChart
                        barCategoryGap="12%"
                        data={dashboard.charts.hourlyDispositionStack}
                        margin={{ top: 6, right: 4, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 6" vertical={false} />
                        <XAxis
                          axisLine={{ stroke: CHART_GRID }}
                          dataKey="hour"
                          stroke={CHART_AXIS}
                          tick={{ fill: CHART_AXIS, fontSize: 10 }}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={{ stroke: CHART_GRID }}
                          stroke={CHART_AXIS}
                          tick={{ fill: CHART_AXIS, fontSize: 10 }}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip content={<DispositionHourTooltip />} />
                        <Bar dataKey="answered" fill={DISP_COLORS.answered} stackId="disp" />
                        <Bar dataKey="forwarded" fill={DISP_COLORS.forwarded} stackId="disp" />
                        <Bar dataKey="abandoned" fill={DISP_COLORS.abandoned} stackId="disp" />
                        <Bar
                          dataKey="other"
                          fill={DISP_COLORS.other}
                          radius={[3, 3, 0, 0]}
                          stackId="disp"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: DISP_COLORS.answered }}
                      />{" "}
                      Answered
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: DISP_COLORS.forwarded }}
                      />{" "}
                      Forwarded
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: DISP_COLORS.abandoned }}
                      />{" "}
                      Abandoned
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: DISP_COLORS.other }}
                      />{" "}
                      Other / unknown
                    </span>
                  </div>
                </Card>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-violet-500/20 bg-violet-500/[0.07]"
                subtitle="Queue mix and disposition labels as ingested from your file."
                title="Distribution & operations"
              >
                <section className="grid gap-4 lg:grid-cols-2">
                  <Card accentColor="#8b5cf6" subtitle="By queue" title="Queue distribution">
                    <div className="h-72">
                      <ResponsiveContainer height="100%" width="100%">
                        <PieChart>
                          <Pie
                            data={dashboard.charts.queueDistribution}
                            dataKey="calls"
                            innerRadius={58}
                            nameKey="queue"
                            outerRadius={88}
                            stroke="rgba(28,42,58,.6)"
                            strokeWidth={1}
                          >
                            {dashboard.charts.queueDistribution.map((_, index) => (
                              <Cell fill={ACCENTS[index % ACCENTS.length]} key={index} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#111620",
                              border: "1px solid rgba(100,116,139,.35)",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "#e2eaf4",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card
                    accentColor="#10b981"
                    subtitle="Raw disposition values"
                    title="Disposition split"
                  >
                    <div className="h-72">
                      {(dashboard.charts.dispositionBreakdown?.length ?? 0) > 0 ? (
                        <ResponsiveContainer height="100%" width="100%">
                          <PieChart>
                            <Pie
                              data={dashboard.charts.dispositionBreakdown}
                              dataKey="calls"
                              innerRadius={58}
                              nameKey="disposition"
                              outerRadius={88}
                              stroke="rgba(28,42,58,.6)"
                              strokeWidth={1}
                            >
                              {(dashboard.charts.dispositionBreakdown ?? []).map((_, index) => (
                                <Cell fill={ACCENTS[index % ACCENTS.length]} key={index} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: "#111620",
                                border: "1px solid rgba(100,116,139,.35)",
                                borderRadius: 8,
                                fontSize: 12,
                                color: "#e2eaf4",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="flex h-full items-center justify-center text-center text-xs text-text-muted">
                          No disposition values in this slice.
                        </p>
                      )}
                    </div>
                  </Card>
                </section>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-amber-500/20 bg-amber-500/[0.07]"
                subtitle="Segmentation of handle time and how average talk trends across the day."
                title="Performance metrics"
              >
                <section className="grid gap-4 lg:grid-cols-2">
                  <Card
                    accentColor="#f59e0b"
                    subtitle="Answered-weighted buckets"
                    title="Talk time distribution"
                  >
                    <div className="h-64">
                      <ResponsiveContainer height="100%" width="100%">
                        <BarChart
                          barCategoryGap="10%"
                          data={dashboard.charts.talkTimeHistogram}
                          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            stroke={CHART_GRID}
                            strokeDasharray="3 6"
                            vertical={false}
                          />
                          <XAxis
                            axisLine={{ stroke: CHART_GRID }}
                            dataKey="bucket"
                            stroke={CHART_AXIS}
                            tick={{ fill: CHART_AXIS, fontSize: 10 }}
                            tickLine={false}
                          />
                          <YAxis
                            axisLine={{ stroke: CHART_GRID }}
                            stroke={CHART_AXIS}
                            tick={{ fill: CHART_AXIS, fontSize: 10 }}
                            tickLine={false}
                            width={32}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "1px solid rgba(100,116,139,.35)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="calls" fill="#ffa726" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card
                    accentColor="#1e88e5"
                    subtitle={`Seconds · by reporting hour (${dashboard.meta.reportingTimeZone ?? "UTC"})`}
                    title="Avg talk by hour"
                  >
                    <div className="h-64">
                      <ResponsiveContainer height="100%" width="100%">
                        <LineChart
                          data={dashboard.charts.avgTalkByHour}
                          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            stroke={CHART_GRID}
                            strokeDasharray="3 6"
                            vertical={false}
                          />
                          <XAxis
                            axisLine={{ stroke: CHART_GRID }}
                            dataKey="hour"
                            stroke={CHART_AXIS}
                            tick={{ fill: CHART_AXIS, fontSize: 10 }}
                            tickLine={false}
                          />
                          <YAxis
                            axisLine={{ stroke: CHART_GRID }}
                            stroke={CHART_AXIS}
                            tick={{ fill: CHART_AXIS, fontSize: 10 }}
                            tickLine={false}
                            width={36}
                          />
                          <Tooltip
                            contentStyle={{
                              border: "1px solid rgba(100,116,139,.35)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Line
                            dataKey="avgTalk"
                            dot={{ r: 3, fill: "#42a5f5", strokeWidth: 0 }}
                            stroke="#42a5f5"
                            strokeWidth={2}
                            type="monotone"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </section>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-sky-500/20 bg-sky-500/[0.07]"
                badge={
                  <span className="rounded-md border border-border-base bg-bg-card2 px-2 py-1 font-mono text-[10px] text-text-secondary">
                    {(leaderboardRows ?? dashboard.charts.agentPerformance).length} agents ·{" "}
                    {dashboard.kpis.totalCalls} calls
                  </span>
                }
                subtitle="Per-agent workload and handle metrics for the filtered dataset."
                title="Agent performance"
              >
                <Card
                  accentColor="#3b82f6"
                  subtitle="Choose a column and direction; the table matches your dashboard filters."
                  title="Agent leaderboard"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-text-secondary" htmlFor="leaderboard-sort-by">
                      Sort by
                    </label>
                    <select
                      className={`min-w-[10rem] ${FILTER_FIELD_BOX} cursor-pointer py-1.5 text-sm text-text-primary`}
                      id="leaderboard-sort-by"
                      onChange={(e) => setLeaderboardSortBy(e.target.value)}
                      value={leaderboardSortBy}
                    >
                      {LEADERBOARD_SORT_COLUMNS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <label className="text-xs text-text-secondary" htmlFor="leaderboard-order">
                      Order
                    </label>
                    <select
                      className={`min-w-[9rem] ${FILTER_FIELD_BOX} cursor-pointer py-1.5 text-sm text-text-primary`}
                      id="leaderboard-order"
                      onChange={(e) => setLeaderboardOrder(e.target.value as "asc" | "desc")}
                      value={leaderboardOrder}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                    {leaderboardLoading ? (
                      <span className="text-xs text-text-secondary">Updating…</span>
                    ) : null}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-base text-left text-text-secondary">
                          <th className="px-2 py-2">Rank</th>
                          <th className="px-2 py-2">Agent</th>
                          <th className="px-2 py-2">Calls</th>
                          <th className="px-2 py-2">Total Talk</th>
                          <th className="px-2 py-2">Avg Talk</th>
                          <th className="px-2 py-2">Avg Wait</th>
                          <th className="px-2 py-2">5m+ Calls</th>
                          <th className="px-2 py-2">Quick&lt;30s</th>
                          <th className="px-2 py-2">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardError ? (
                          <tr>
                            <td className="px-2 py-6 text-center text-rose-400" colSpan={9}>
                              {leaderboardError}
                            </td>
                          </tr>
                        ) : null}
                        {!leaderboardError && leaderboardLoading && !leaderboardRows ? (
                          <tr>
                            <td className="px-2 py-6 text-center text-text-secondary" colSpan={9}>
                              Loading leaderboard…
                            </td>
                          </tr>
                        ) : null}
                        {!leaderboardError && leaderboardRows
                          ? leaderboardRows.map((row, index) => (
                              <tr
                                className="border-b border-border-base/60"
                                key={`${row.agentName}-${index}`}
                              >
                                <td className="px-2 py-2">#{index + 1}</td>
                                <td className="px-2 py-2">{row.agentName}</td>
                                <td className="px-2 py-2">{row.calls}</td>
                                <td className="px-2 py-2">{row.totalTalk}s</td>
                                <td className="px-2 py-2">{row.avgTalk}s</td>
                                <td className="px-2 py-2">{row.avgWait}s</td>
                                <td className="px-2 py-2">{row.extraLongCalls}</td>
                                <td className="px-2 py-2">{row.shortCalls}</td>
                                <td className="px-2 py-2">{row.sharePct}%</td>
                              </tr>
                            ))
                          : null}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-cyan-500/20 bg-cyan-500/[0.07]"
                subtitle="Scalar mode: one aggregated number per agent/queue (bars). Time-series mode: column averages by hour or day (multi-line, one color per entity)."
                title="Compare agents & queues"
              >
                <section className="grid gap-6 lg:grid-cols-2">
                  <Card
                    accentColor="#06b6d4"
                    subtitle="Multi-select agents, scalar catalog or time-series column"
                    title="Agent comparison"
                  >
                    <div className="mb-3 space-y-2">
                      <span className={FILTER_SECTION_LABEL}>Comparison type</span>
                      <select
                        className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                        onChange={(e) =>
                          setAgentCompareMode(e.target.value as "scalar" | "time_series")
                        }
                        value={agentCompareMode}
                      >
                        <option value="scalar">Scalar metrics (one value per agent — bars)</option>
                        <option value="time_series">Time series (column vs time — lines)</option>
                      </select>
                      {agentCompareMode === "scalar" ? (
                        <>
                          <span className={FILTER_SECTION_LABEL}>Measure</span>
                          <select
                            className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                            onChange={(e) =>
                              setAgentCompareMeasure(e.target.value as CompareMeasureId)
                            }
                            value={agentCompareMeasure}
                          >
                            {COMPARE_MEASURE_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <span className={FILTER_SECTION_LABEL}>Column</span>
                          <select
                            className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                            onChange={(e) => setAgentTsColumn(e.target.value as TsColumnId)}
                            value={agentTsColumn}
                          >
                            {TS_COLUMN_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <span className={FILTER_SECTION_LABEL}>Time bucket</span>
                          <select
                            className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                            onChange={(e) => setAgentTsBucket(e.target.value as "hour" | "day")}
                            value={agentTsBucket}
                          >
                            <option value="hour">By hour (reporting TZ)</option>
                            <option value="day">By day</option>
                          </select>
                        </>
                      )}
                      <span className={FILTER_SECTION_LABEL}>Agents (min 2)</span>
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border-base bg-bg-card2 px-2 py-2">
                        {(dashboard.meta.agents ?? []).length === 0 ? (
                          <p className="text-xs text-text-muted">No agents in this upload.</p>
                        ) : (
                          dashboard.meta.agents.map((a) => (
                            <label
                              className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary"
                              key={a}
                            >
                              <input
                                checked={compareAgents.includes(a)}
                                className="rounded border-border-base"
                                onChange={() => toggleCompareAgent(a)}
                                type="checkbox"
                              />
                              <span className="text-text-primary">{a}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {agentCompareError ? (
                        <p className="text-xs text-accent-red">{agentCompareError}</p>
                      ) : null}
                      {agentCompareLoading ? (
                        <p className="text-xs text-text-muted">Loading…</p>
                      ) : null}
                    </div>
                    <div className="h-64">
                      {agentCompareMode === "scalar" &&
                      agentScalarData &&
                      compareAgents.length >= 2 &&
                      agentScalarData.points.length > 0 ? (
                        <ResponsiveContainer height="100%" width="100%">
                          <BarChart
                            barCategoryGap="12%"
                            data={agentScalarData.points}
                            margin={{ top: 4, right: 8, left: 0, bottom: 48 }}
                          >
                            <CartesianGrid
                              stroke={CHART_GRID}
                              strokeDasharray="3 6"
                              vertical={false}
                            />
                            <XAxis
                              angle={-20}
                              axisLine={{ stroke: CHART_GRID }}
                              dataKey="name"
                              height={48}
                              interval={0}
                              stroke={CHART_AXIS}
                              textAnchor="end"
                              tick={{ fill: CHART_AXIS, fontSize: 9 }}
                              tickLine={false}
                            />
                            <YAxis
                              axisLine={{ stroke: CHART_GRID }}
                              stroke={CHART_AXIS}
                              tick={{ fill: CHART_AXIS, fontSize: 10 }}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#111620",
                                border: "1px solid rgba(100,116,139,.35)",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            <Bar dataKey="value" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : agentCompareMode === "time_series" &&
                        agentTsData &&
                        agentTimeSeriesChart &&
                        compareAgents.length >= 2 &&
                        agentTsData.series.some((s) => s.points.length > 0) ? (
                        <ResponsiveContainer height="100%" width="100%">
                          <LineChart
                            data={agentTimeSeriesChart.rows}
                            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              stroke={CHART_GRID}
                              strokeDasharray="3 6"
                              vertical={false}
                            />
                            <XAxis
                              angle={-20}
                              axisLine={{ stroke: CHART_GRID }}
                              dataKey="bucketKey"
                              height={48}
                              interval={0}
                              stroke={CHART_AXIS}
                              textAnchor="end"
                              tick={{ fill: CHART_AXIS, fontSize: 9 }}
                              tickLine={false}
                            />
                            <YAxis
                              axisLine={{ stroke: CHART_GRID }}
                              stroke={CHART_AXIS}
                              tick={{ fill: CHART_AXIS, fontSize: 10 }}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#111620",
                                border: "1px solid rgba(100,116,139,.35)",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            {agentTsData.series.map((s, i) => (
                              <Line
                                connectNulls
                                dataKey={agentTimeSeriesChart.lineKeys[i] ?? ""}
                                dot={{ r: 2 }}
                                key={s.name}
                                name={s.name}
                                stroke={ACCENTS[i % ACCENTS.length]}
                                strokeWidth={2}
                                type="monotone"
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="flex h-full items-center justify-center text-center text-xs text-text-muted">
                          Select two or more agents.
                          {agentCompareMode === "scalar"
                            ? ` Measure: ${COMPARE_MEASURE_OPTIONS.find((m) => m.id === agentCompareMeasure)?.label ?? ""}.`
                            : " Column vs time bucket (rows need dateTime)."}
                        </p>
                      )}
                    </div>
                    {agentScalarData && agentCompareMode === "scalar" ? (
                      <p className="mt-2 text-[10px] text-text-muted">
                        {agentScalarData.measureLabel}
                      </p>
                    ) : null}
                    {agentTsData && agentCompareMode === "time_series" ? (
                      <p className="mt-2 text-[10px] text-text-muted">
                        {agentTsData.column} · {agentTsData.bucket} · avg in bucket
                      </p>
                    ) : null}
                  </Card>

                  <Card
                    accentColor="#14b8a6"
                    subtitle="Multi-select queues, scalar catalog or time-series column"
                    title="Queue comparison"
                  >
                    <div className="mb-3 space-y-2">
                      <span className={FILTER_SECTION_LABEL}>Comparison type</span>
                      <select
                        className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                        onChange={(e) =>
                          setQueueCompareMode(e.target.value as "scalar" | "time_series")
                        }
                        value={queueCompareMode}
                      >
                        <option value="scalar">Scalar metrics (one value per queue — bars)</option>
                        <option value="time_series">Time series (column vs time — lines)</option>
                      </select>
                      {queueCompareMode === "scalar" ? (
                        <>
                          <span className={FILTER_SECTION_LABEL}>Measure</span>
                          <select
                            className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                            onChange={(e) =>
                              setQueueCompareMeasure(e.target.value as CompareMeasureId)
                            }
                            value={queueCompareMeasure}
                          >
                            {COMPARE_MEASURE_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <span className={FILTER_SECTION_LABEL}>Column</span>
                          <select
                            className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                            onChange={(e) => setQueueTsColumn(e.target.value as TsColumnId)}
                            value={queueTsColumn}
                          >
                            {TS_COLUMN_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <span className={FILTER_SECTION_LABEL}>Time bucket</span>
                          <select
                            className={`w-full ${FILTER_FIELD_BOX} cursor-pointer py-2 text-sm text-text-primary`}
                            onChange={(e) => setQueueTsBucket(e.target.value as "hour" | "day")}
                            value={queueTsBucket}
                          >
                            <option value="hour">By hour (reporting TZ)</option>
                            <option value="day">By day</option>
                          </select>
                        </>
                      )}
                      <span className={FILTER_SECTION_LABEL}>Queues (min 2)</span>
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border-base bg-bg-card2 px-2 py-2">
                        {(dashboard.meta.queues ?? []).length === 0 ? (
                          <p className="text-xs text-text-muted">No queues in this upload.</p>
                        ) : (
                          dashboard.meta.queues.map((q) => (
                            <label
                              className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary"
                              key={q}
                            >
                              <input
                                checked={compareQueues.includes(q)}
                                className="rounded border-border-base"
                                onChange={() => toggleCompareQueue(q)}
                                type="checkbox"
                              />
                              <span className="text-text-primary">{q}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {queueCompareError ? (
                        <p className="text-xs text-accent-red">{queueCompareError}</p>
                      ) : null}
                      {queueCompareLoading ? (
                        <p className="text-xs text-text-muted">Loading…</p>
                      ) : null}
                    </div>
                    <div className="h-64">
                      {queueCompareMode === "scalar" &&
                      queueScalarData &&
                      compareQueues.length >= 2 &&
                      queueScalarData.points.length > 0 ? (
                        <ResponsiveContainer height="100%" width="100%">
                          <BarChart
                            barCategoryGap="12%"
                            data={queueScalarData.points}
                            margin={{ top: 4, right: 8, left: 0, bottom: 48 }}
                          >
                            <CartesianGrid
                              stroke={CHART_GRID}
                              strokeDasharray="3 6"
                              vertical={false}
                            />
                            <XAxis
                              angle={-20}
                              axisLine={{ stroke: CHART_GRID }}
                              dataKey="name"
                              height={48}
                              interval={0}
                              stroke={CHART_AXIS}
                              textAnchor="end"
                              tick={{ fill: CHART_AXIS, fontSize: 9 }}
                              tickLine={false}
                            />
                            <YAxis
                              axisLine={{ stroke: CHART_GRID }}
                              stroke={CHART_AXIS}
                              tick={{ fill: CHART_AXIS, fontSize: 10 }}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#111620",
                                border: "1px solid rgba(100,116,139,.35)",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            <Bar dataKey="value" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : queueCompareMode === "time_series" &&
                        queueTsData &&
                        queueTimeSeriesChart &&
                        compareQueues.length >= 2 &&
                        queueTsData.series.some((s) => s.points.length > 0) ? (
                        <ResponsiveContainer height="100%" width="100%">
                          <LineChart
                            data={queueTimeSeriesChart.rows}
                            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              stroke={CHART_GRID}
                              strokeDasharray="3 6"
                              vertical={false}
                            />
                            <XAxis
                              angle={-20}
                              axisLine={{ stroke: CHART_GRID }}
                              dataKey="bucketKey"
                              height={48}
                              interval={0}
                              stroke={CHART_AXIS}
                              textAnchor="end"
                              tick={{ fill: CHART_AXIS, fontSize: 9 }}
                              tickLine={false}
                            />
                            <YAxis
                              axisLine={{ stroke: CHART_GRID }}
                              stroke={CHART_AXIS}
                              tick={{ fill: CHART_AXIS, fontSize: 10 }}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#111620",
                                border: "1px solid rgba(100,116,139,.35)",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            {queueTsData.series.map((s, i) => (
                              <Line
                                connectNulls
                                dataKey={queueTimeSeriesChart.lineKeys[i] ?? ""}
                                dot={{ r: 2 }}
                                key={s.name}
                                name={s.name}
                                stroke={ACCENTS[i % ACCENTS.length]}
                                strokeWidth={2}
                                type="monotone"
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="flex h-full items-center justify-center text-center text-xs text-text-muted">
                          Select two or more queues.
                          {queueCompareMode === "scalar"
                            ? ` Measure: ${COMPARE_MEASURE_OPTIONS.find((m) => m.id === queueCompareMeasure)?.label ?? ""}.`
                            : " Column vs time bucket (rows need dateTime)."}
                        </p>
                      )}
                    </div>
                    {queueScalarData && queueCompareMode === "scalar" ? (
                      <p className="mt-2 text-[10px] text-text-muted">
                        {queueScalarData.measureLabel}
                      </p>
                    ) : null}
                    {queueTsData && queueCompareMode === "time_series" ? (
                      <p className="mt-2 text-[10px] text-text-muted">
                        {queueTsData.column} · {queueTsData.bucket} · avg in bucket
                      </p>
                    ) : null}
                  </Card>
                </section>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-purple-500/20 bg-purple-500/[0.07]"
                subtitle={`Intensity by reporting hour (${dashboard.meta.reportingTimeZone ?? "UTC"}) — scroll horizontally on smaller viewports.`}
                title="Agent × hour heatmap"
              >
                <Card
                  accentColor="#8b5cf6"
                  subtitle={`Rows are agents; columns are hours 0–23 (${dashboard.meta.reportingTimeZone ?? "UTC"})`}
                  title="Heatmap"
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-1 text-xs">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left text-text-secondary">Agent</th>
                          {Array.from({ length: 24 }, (_, hour) => (
                            <th className="px-1 py-1 text-text-muted" key={hour}>
                              {hour}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapRows.map((row) => (
                          <tr key={row.agent}>
                            <td className="pr-2 text-text-secondary">{row.agent}</td>
                            {row.cells.map((cell) => (
                              <td
                                className="h-6 w-6 rounded text-center text-[10px]"
                                key={`${row.agent}-${cell.hour}`}
                                style={{
                                  backgroundColor:
                                    cell.intensity === 0
                                      ? "#111827"
                                      : `rgba(59,130,246,${cell.intensity})`,
                                }}
                              >
                                {cell.count > 0 ? cell.count : ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </DashboardSection>

              <DashboardSection
                accentBorder="border-teal-500/20 bg-teal-500/[0.07]"
                subtitle="Average queue wait (seconds) by hour bucket."
                title="Wait experience"
              >
                <Card accentColor="#10b981" subtitle="Area · seconds" title="Wait time by hour">
                  <div className="h-56">
                    <ResponsiveContainer height="100%" width="100%">
                      <AreaChart
                        data={dashboard.charts.waitTimeByHour}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 6" vertical={false} />
                        <XAxis
                          axisLine={{ stroke: CHART_GRID }}
                          dataKey="hour"
                          stroke={CHART_AXIS}
                          tick={{ fill: CHART_AXIS, fontSize: 10 }}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={{ stroke: CHART_GRID }}
                          stroke={CHART_AXIS}
                          tick={{ fill: CHART_AXIS, fontSize: 10 }}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#111620",
                            border: "1px solid rgba(100,116,139,.35)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "#e2eaf4",
                          }}
                          formatter={(v) => [`${String(v)}s`, "Avg wait"]}
                        />
                        <Area
                          dataKey="avgWait"
                          fill="rgba(38,166,154,0.15)"
                          stroke="#26a69a"
                          strokeWidth={2}
                          type="monotone"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </DashboardSection>
            </>
          )}
        </div>
      </div>

      <button
        aria-label="Open AI chat"
        className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue text-white shadow-lg shadow-accent-blue/30 transition hover:scale-105 hover:bg-accent-blue/90"
        onClick={() => setIsChatOpen(true)}
        type="button"
      >
        <svg
          aria-hidden
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </button>

      <div
        className={`fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-border-base bg-bg-card transition-transform duration-300 ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-base px-4 py-3">
          <h3 className="text-sm font-semibold">AI Query</h3>
          <button
            aria-label="Close AI chat"
            className="rounded px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => setIsChatOpen(false)}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
          {uploadId ? (
            <TierGate currentTier={account.tier} requiredTier="PRO">
              <QueryPanel tier={account.tier} uploadId={uploadId} />
            </TierGate>
          ) : (
            <Card accentColor="#3b82f6" subtitle="Select upload first" title="AI Query">
              <p className="text-sm text-text-secondary">
                Open dashboard from an upload to run AI queries.
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
