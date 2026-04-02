export const PipelineStep = {
  HTTP_REQUEST: "HTTP_REQUEST",
  UPLOAD_VALIDATE: "UPLOAD_VALIDATE",
  UPLOAD_COLUMN_DETECT: "UPLOAD_COLUMN_DETECT",
  UPLOAD_PERSIST: "UPLOAD_PERSIST",
  LOAD_CSV_FOR_UPLOAD: "LOAD_CSV_FOR_UPLOAD",
  ANALYTICS_FILTER: "ANALYTICS_FILTER",
  ANALYTICS_COMPUTE: "ANALYTICS_COMPUTE",
  AI_GEMINI_PARSE: "AI_GEMINI_PARSE",
  AI_BILLING_CHECK: "AI_BILLING_CHECK",
  AI_QUERY_EXECUTE: "AI_QUERY_EXECUTE",
  AI_REPORT_PERSIST: "AI_REPORT_PERSIST",
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_REGISTER: "AUTH_REGISTER",
} as const;

export type PipelineStepName = (typeof PipelineStep)[keyof typeof PipelineStep];

export type PipelinePhase = "before" | "after" | "error";

export type LogLevelName = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
