import pino from "pino";

import type { LogLevelName } from "./pipeline-steps.js";

export type TerminalLogger = pino.Logger;

export function createTerminalLogger(level: LogLevelName | string): TerminalLogger {
  return pino({
    level: level === "silent" ? "silent" : level,
  });
}
