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
  answerRate: number;
  abandonedCalls: number;
  longCalls5m: number;
}

export interface DashboardResult {
  kpis: DashboardKPIs;
  charts: {
    hourlyCallVolume: { hour: string; calls: number }[];
    queueDistribution: { queue: string; calls: number }[];
    talkTimeHistogram: { bucket: "<30s" | "30s-2m" | "2m-5m" | "5m-10m" | ">10m"; calls: number }[];
    avgTalkByHour: { hour: string; avgTalk: number }[];
    agentPerformance: {
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
    }[];
    agentHourHeatmap: { agent: string; hour: number; count: number }[];
    dailyTrend?: { date: string; calls: number }[];
    dispositionBreakdown?: { disposition: string; calls: number }[];
    topAgents: { agentName: string; calls: number }[];
    waitTimeByHour: { hour: string; avgWait: number }[];
    hourlyDispositionStack: {
      hour: string;
      answered: number;
      abandoned: number;
      forwarded: number;
      other: number;
    }[];
  };
  intelligence: {
    repeatCallerSummary: {
      totalRepeatCallers: number;
      totalRepeatCalls: number;
      topRepeatCallers: Array<{ callerPhone: string; calls: number }>;
    };
    recommendation: string;
  };
}
