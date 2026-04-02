export {};

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      /** Pairs `HTTP_REQUEST` before/after rows for the same inbound request. */
      httpProbeSpanId?: string;
    }
  }
}
