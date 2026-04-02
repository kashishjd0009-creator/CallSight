export const SUPPORTED_METRICS = [
  "total_calls",
  "total_talk_time",
  "total_wait_time",
  "total_hold_time",
  "total_wrap_time",
  "avg_talk_time",
  "avg_wait_time",
  "aht",
  "max_talk_time",
  "min_talk_time",
  "call_distribution_by_hour",
  "call_distribution_by_queue",
  "calls_by_day",
  "calls_by_disposition",
  "peak_hour",
  "peak_day",
  "talk_time_histogram",
  "service_level_pct",
  "short_call_rate",
  "long_call_rate",
  "avg_talk_by_agent",
  "avg_talk_by_queue",
  "avg_talk_by_hour",
  "avg_wait_by_queue",
  "service_level_by_queue",
  "calls_and_talk_by_queue",
  "calls_by_agent",
  "avg_wait_by_agent",
  "top_n_agents",
  "top_n_agents_by_total_talk_time",
  "top_n_agents_by_avg_talk_time",
  "bottom_n_agents_by_call_count",
  "bottom_n_agents_by_total_talk_time",
  "agent_share_pct",
  "top_n_agents_by_total_wait_time",
  "disposition_breakdown",
  "abandonment_rate",
  "answer_rate",
  "transfer_rate",
  "forward_rate",
  "repeat_callers_count",
  "top_callers_by_volume",
  "calls_per_caller_distribution",
  "never_answered_repeat_callers",
  "aht_ranking_by_agent",
  "worst_hour_by_abandon_count",
  "abandon_analysis_bundle",
  "long_calls_by_agent_count",
  "quick_call_red_flag_by_agent",
  "trainee_vs_tenured_compare",
] as const;

export type SupportedMetric = (typeof SUPPORTED_METRICS)[number];

export interface ParsedQuery {
  metric: SupportedMetric;
  filters: {
    agentName: string | null;
    queue: string | null;
    dateRange: { from: string | null; to: string | null };
    hour: number | null;
  };
  parameters: {
    n: number;
  };
  visualizationType: "number" | "bar" | "line" | "pie" | "table";
  naturalLanguageDescription: string;
}
