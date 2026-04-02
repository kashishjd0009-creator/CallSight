export type Tier = "FREE" | "PRO" | "PREMIUM";

export interface UploadFile {
  originalName: string;
  sizeBytes: number;
  content: string;
}
