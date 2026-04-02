import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
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

import { fetchWithAuthRetry } from "../../lib/auth-api.js";
import { userMessageFromApiError } from "../../lib/map-api-error.js";
import { normalizeQueryResultForRender } from "../../lib/normalize-query-result.js";
import { Button } from "../ui/Button.js";

type QueryVisualization = "number" | "bar" | "line" | "pie" | "table";

type QueryMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      visualizationType: QueryVisualization;
      description: string;
      value: number | Array<{ key: string; value: number }>;
    }
  | { id: string; role: "error"; text: string };

type ApiQueryResult = {
  value: number | Array<{ key: string; value: number }>;
  visualizationType: QueryVisualization;
  naturalLanguageDescription: string;
};

interface QueryPanelProps {
  tier: "FREE" | "PRO" | "PREMIUM";
  uploadId: string;
}

const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function QueryPanel({ tier, uploadId }: QueryPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<QueryMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usageLabel, setUsageLabel] = useState<string>("");

  const canUse = tier === "PRO" || tier === "PREMIUM";

  const refreshUsage = useCallback(async () => {
    if (!canUse) {
      return;
    }
    try {
      const response = await fetchWithAuthRetry(`${API_URL}/api/v1/query/usage`);
      const body = (await response.json()) as {
        data?: { used: number; limit: number | null; remaining: number | null };
      };
      if (!response.ok || !body.data) {
        return;
      }
      const { used, limit, remaining } = body.data;
      if (limit === null || remaining === null) {
        setUsageLabel(`${used} queries used (unlimited)`);
      } else {
        setUsageLabel(`${used} / ${limit} this month (${remaining} left)`);
      }
    } catch {
      setUsageLabel("");
    }
  }, [canUse]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const placeholder = "Ask about your upload — e.g. total calls, AHT, top agents, calls by queue…";

  const submitQuery = async () => {
    if (!canUse || !uploadId.trim()) {
      return;
    }
    const query = input.trim();
    if (!query) {
      return;
    }
    setInput("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: query }]);
    setIsLoading(true);

    try {
      const response = await fetchWithAuthRetry(`${API_URL}/api/v1/query/${uploadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = (await response.json()) as {
        success?: boolean;
        data?: ApiQueryResult;
        error?: { code?: string; message?: string };
      };

      if (!response.ok) {
        throw new Error(
          userMessageFromApiError(
            response.status,
            body.error,
            "We couldn't run that query. Please try again.",
          ),
        );
      }
      if (!body.data) {
        throw new Error("Invalid response");
      }

      const result = normalizeQueryResultForRender(body.data);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          visualizationType: result.visualizationType,
          description: result.naturalLanguageDescription,
          value: result.value,
        },
      ]);
      void refreshUsage();
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error",
          text: e instanceof Error ? e.message : "Query failed",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        if (message.role === "user") {
          return (
            <div className="flex justify-end" key={message.id}>
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent-blue px-3 py-2 text-sm text-white">
                {message.text}
              </div>
            </div>
          );
        }

        if (message.role === "error") {
          return (
            <div className="flex justify-start" key={message.id}>
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
                {message.text}
              </div>
            </div>
          );
        }

        return (
          <div className="flex justify-start" key={message.id}>
            <div className="w-full max-w-[92%] rounded-2xl rounded-bl-sm border border-border-base bg-bg-card2 p-3">
              <p className="mb-2 text-xs text-text-secondary">{message.description}</p>
              {message.visualizationType === "number" && typeof message.value === "number" && (
                <p className="text-3xl font-bold text-text-primary">{message.value}</p>
              )}
              {message.visualizationType === "bar" && Array.isArray(message.value) && (
                <div className="h-40">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={message.value}>
                      <XAxis dataKey="key" hide />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {message.visualizationType === "table" && Array.isArray(message.value) && (
                <table className="w-full text-xs">
                  <tbody>
                    {message.value.map((row) => (
                      <tr className="border-b border-border-base/60" key={row.key}>
                        <td className="py-1 text-text-secondary">{row.key}</td>
                        <td className="py-1 text-right text-text-primary">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {message.visualizationType === "line" && Array.isArray(message.value) && (
                <div className="h-40">
                  <ResponsiveContainer height="100%" width="100%">
                    <LineChart data={message.value}>
                      <XAxis dataKey="key" hide />
                      <YAxis hide />
                      <Tooltip />
                      <Line dataKey="value" dot type="monotone" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {message.visualizationType === "pie" && Array.isArray(message.value) && (
                <div className="h-40">
                  <ResponsiveContainer height="100%" width="100%">
                    <PieChart>
                      <Pie
                        data={message.value}
                        dataKey="value"
                        innerRadius={45}
                        nameKey="key"
                        outerRadius={65}
                      >
                        {message.value.map((_, index) => (
                          <Cell
                            fill={palette[index % palette.length]}
                            key={`${message.id}-${index}`}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        );
      }),
    [messages],
  );

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      {canUse && usageLabel ? (
        <header className="mb-3 shrink-0 flex justify-end">
          <p className="text-xs text-text-secondary">{usageLabel}</p>
        </header>
      ) : null}

      {!uploadId.trim() ? (
        <p className="mb-3 shrink-0 text-xs text-text-muted">
          Open the dashboard from an upload so queries run on that file.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-border-base bg-bg-primary/60 p-3">
        {renderedMessages}
        {isLoading && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border-base bg-bg-card2 px-3 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-text-secondary" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-text-secondary [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-text-secondary [animation-delay:240ms]" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-border-base/80 pt-3">
        <input
          className="flex-1 rounded-lg border border-border-base bg-bg-card2 px-3 py-2 text-sm outline-none focus:border-accent-blue disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canUse || isLoading || !uploadId.trim()}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canUse) {
              void submitQuery();
            }
          }}
          placeholder={placeholder}
          value={input}
        />
        <Button
          disabled={!canUse || isLoading || !uploadId.trim()}
          onClick={() => void submitQuery()}
        >
          Send
        </Button>
      </div>
    </section>
  );
}
