import { z } from "zod";

export const uploadCsvSchema = z.object({
  fileName: z.string().min(1),
});
