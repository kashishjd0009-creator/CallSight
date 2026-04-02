export type ProbeViewerQueryInput = {
  page?: number;
  pageSize?: number;
  search?: string;
  step?: string;
  sortDir?: "asc" | "desc";
};

export function buildProbeViewerQuery(input: ProbeViewerQueryInput): string {
  const params = new URLSearchParams();
  params.set("page", String(input.page ?? 1));
  params.set("pageSize", String(input.pageSize ?? 25));
  params.set("sortDir", input.sortDir ?? "desc");
  const search = input.search?.trim();
  const step = input.step?.trim();
  if (search) {
    params.set("search", search);
  }
  if (step) {
    params.set("step", step);
  }
  return params.toString();
}
