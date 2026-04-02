import { z } from "zod";

export const updateTierSchema = z.object({
  tier: z.enum(["FREE", "PRO", "PREMIUM"]),
});
