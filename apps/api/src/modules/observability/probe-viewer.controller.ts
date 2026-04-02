import type { Request, Response } from "express";
import { z } from "zod";

import { ok } from "../../core/http.js";
import type { ObservabilityService } from "./observability.service.js";
import { mapEventsToProbeRows } from "./probe-viewer.mapper.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  step: z.string().trim().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export class ProbeViewerController {
  constructor(private readonly observability: ObservabilityService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const parsed = querySchema.parse(req.query);
    const result = await this.observability.findForProbeViewer({
      page: parsed.page,
      pageSize: parsed.pageSize,
      search: parsed.search,
      step: parsed.step,
      sortDir: parsed.sortDir,
    });
    const rows = mapEventsToProbeRows(result.rows);
    const totalPages = Math.max(1, Math.ceil(result.total / parsed.pageSize));
    ok(res, {
      rows,
      page: parsed.page,
      pageSize: parsed.pageSize,
      total: result.total,
      totalPages,
    });
  };
}
