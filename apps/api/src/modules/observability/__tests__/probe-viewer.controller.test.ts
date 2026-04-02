import { describe, expect, it, vi } from "vitest";

import { ProbeViewerController } from "../probe-viewer.controller.js";

describe("ProbeViewerController", () => {
  it("uses defaults: page 1, pageSize 25, newest first", async () => {
    const findForProbeViewer = vi.fn().mockResolvedValue({ rows: [], total: 0 });
    const controller = new ProbeViewerController({ findForProbeViewer } as never);
    const req = { query: {} } as never;
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as never;

    await controller.list(req, res);

    expect(findForProbeViewer).toHaveBeenCalledWith({
      page: 1,
      pageSize: 25,
      search: undefined,
      step: undefined,
      sortDir: "desc",
    });
  });
});
