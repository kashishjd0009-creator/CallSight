import { BillingService } from "../billing/billing.service.js";
import type { CanonicalCallRecord } from "../analytics/analytics.types.js";
import { QueryExecutor } from "./query-executor.js";
import type { QueryResult } from "./query-executor.js";
import type { ParsedQuery } from "./query.types.js";
import { normalizeQueryResultForClient } from "./normalize-query-result.js";

type ExecuteForUserResult =
  | {
      blocked: true;
      allowance: {
        allowed: boolean;
        limit: number | null;
        remaining: number | null;
        error?: "QUERY_LIMIT_REACHED";
        upgradeUrl?: "/pricing";
      };
    }
  | {
      blocked: false;
      allowance: {
        allowed: boolean;
        limit: number | null;
        remaining: number | null;
        error?: "QUERY_LIMIT_REACHED";
        upgradeUrl?: "/pricing";
      };
      result: QueryResult;
    };

export class AiQueryService {
  constructor(
    private readonly billingService: BillingService,
    private readonly queryExecutor: QueryExecutor,
  ) {}

  async executeForUser(
    userId: string,
    parsedQuery: ParsedQuery,
    records: CanonicalCallRecord[],
  ): Promise<ExecuteForUserResult> {
    const allowance = await this.billingService.checkQueryAllowedForUser(userId);
    if (!allowance.allowed) {
      return {
        blocked: true as const,
        allowance,
      };
    }

    const rawResult = this.queryExecutor.execute(parsedQuery, records);
    const result = normalizeQueryResultForClient(rawResult);
    await this.billingService.incrementQueryUsage(userId);
    const snapshotAfter = await this.billingService.getUserSnapshot(userId);
    const allowanceAfter = this.billingService.checkQueryAllowed(snapshotAfter);
    return {
      blocked: false as const,
      allowance: allowanceAfter,
      result,
    };
  }
}
