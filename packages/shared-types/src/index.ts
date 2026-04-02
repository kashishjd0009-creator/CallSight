export type Tier = "FREE" | "PRO" | "PREMIUM";

export interface CanonicalCallRecord {
  callId?: string;
  queue?: string;
  agentName?: string;
  dateTime?: Date;
  answeredAt?: Date;
  extension?: string;
  callerPhone?: string;
  disposition?: string;
  talkTime?: number;
  waitTime?: number;
  holdTime?: number;
  wrapUpTime?: number;
  customTag?: string;
}

export interface DashboardKPIs {
  totalCalls: number;
  totalTalkTime: number;
  totalWaitTime: number;
  avgHandleTime: number;
  avgTalkTime: number;
  avgWaitTime: number;
  serviceLevel: number;
  shortCallRate: number;
  longestCall: number;
  agentCount: number;
  callsPerAgent: number;
  peakHour: string;
  peakAgent: string;
  totalAgents: number;
  queues: string[];
}

export interface HourlyCallVolumePoint {
  hour: string;
  calls: number;
}

export interface QueueDistributionPoint {
  queue: string;
  calls: number;
}

export interface TalkTimeHistogramPoint {
  bucket: "<30s" | "30s-2m" | "2m-5m" | "5m-10m" | ">10m";
  calls: number;
}

export interface AvgTalkByHourPoint {
  hour: string;
  avgTalk: number;
}

export interface AgentPerformanceRow {
  agentName: string;
  calls: number;
  totalTalk: number;
  avgTalk: number;
  avgWait: number;
  sharePct: number;
  shortCalls: number;
  mediumCalls: number;
  longCalls: number;
  extraLongCalls: number;
}

export interface AgentHourHeatmapCell {
  agent: string;
  hour: number;
  count: number;
}

export interface DailyTrendPoint {
  date: string;
  calls: number;
}

export interface DispositionBreakdownPoint {
  disposition: string;
  calls: number;
}

export interface TopAgentPoint {
  agentName: string;
  calls: number;
}

export interface WaitTimeByHourPoint {
  hour: string;
  avgWait: number;
}

export interface DashboardChartData {
  hourlyCallVolume: HourlyCallVolumePoint[];
  queueDistribution: QueueDistributionPoint[];
  talkTimeHistogram: TalkTimeHistogramPoint[];
  avgTalkByHour: AvgTalkByHourPoint[];
  agentPerformance: AgentPerformanceRow[];
  agentHourHeatmap: AgentHourHeatmapCell[];
  dailyTrend?: DailyTrendPoint[];
  dispositionBreakdown?: DispositionBreakdownPoint[];
  topAgents: TopAgentPoint[];
  waitTimeByHour: WaitTimeByHourPoint[];
}
