import { z } from "zod";

export const billingUsageQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
