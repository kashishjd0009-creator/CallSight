import axios from "axios";
import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Link } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { useAuthSession } from "../contexts/auth-session-context.js";
import { userMessageFromApiError } from "../lib/map-api-error.js";

type Tier = "FREE" | "PRO" | "PREMIUM";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const REQUIRED_CANONICAL = [
  { key: "agentName", label: "Agent Name" },
  { key: "talkTime", label: "Talk Time" },
  { key: "waitTime", label: "Wait Time" },
  { key: "queue", label: "Call Queue" },
  { key: "dateTime", label: "Date/Time" },
  { key: "disposition", label: "Disposition" },
  { key: "extension", label: "Extension" },
  { key: "customTag", label: "Custom Tag" },
] as const;

const tierLimitBytes: Record<Tier, number> = {
  FREE: 5 * 1024 * 1024,
  PRO: 50 * 1024 * 1024,
  PREMIUM: 200 * 1024 * 1024,
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export function UploadPage() {
  const { account, canViewProbe } = useAuthSession();
  const tier = account.tier;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedId, setUploadedId] = useState<string>("");
  const [detectedMap, setDetectedMap] = useState<Record<string, string>>({});

  const limit = tierLimitBytes[tier];

  const onDrop = (accepted: File[]) => {
    const file = accepted[0];
    if (!file) {
      return;
    }

    setError("");
    setUploadedId("");
    setDetectedMap({});
    setProgress(0);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are accepted.");
      setSelectedFile(null);
      return;
    }

    if (file.size > limit) {
      setError(`File exceeds ${formatBytes(limit)} limit for ${tier}.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "text/csv": [".csv"] },
  });

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose a CSV file first.");
      return;
    }

    setError("");
    setIsUploading(true);
    setProgress(0);
    setUploadedId("");
    setDetectedMap({});

    try {
      const csvContent = await selectedFile.text();
      const response = await axios.post(
        `${API_URL}/api/v1/uploads`,
        {
          fileName: selectedFile.name,
          csvContent,
          sizeBytes: selectedFile.size,
        },
        {
          withCredentials: true,
          onUploadProgress: (event) => {
            const total = event.total ?? selectedFile.size;
            if (total > 0) {
              setProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
            }
          },
        },
      );

      const data = (response.data as { data?: { id?: string; columnMap?: Record<string, string> } })
        .data;
      setUploadedId(data?.id ?? "");
      setDetectedMap(data?.columnMap ?? {});
      setProgress(100);
    } catch (uploadError) {
      if (axios.isAxiosError(uploadError)) {
        const status = uploadError.response?.status ?? 0;
        const errPayload = uploadError.response?.data as
          | { error?: { code?: string; message?: string } }
          | undefined;
        setError(
          userMessageFromApiError(status, errPayload?.error, "Upload failed. Please try again."),
        );
      } else {
        setError("Upload failed.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const matchedCount = useMemo(
    () => REQUIRED_CANONICAL.filter((item) => Boolean(detectedMap[item.key])).length,
    [detectedMap],
  );

  return (
    <AppShell accountTier={account.tier} canViewProbe={canViewProbe}>
      <div className="min-h-full p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Card
            accentColor="#3b82f6"
            subtitle={`Limit: ${formatBytes(limit)} for ${tier}`}
            title="Dropzone Upload"
          >
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragActive
                  ? "border-accent-blue bg-accent-blue/10"
                  : "border-border-base bg-bg-card2"
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-sm text-text-secondary">
                {isDragActive ? "Drop the CSV here..." : "Drag and drop CSV, or click to browse"}
              </p>
              <p className="mt-1 text-xs text-text-muted">Only .csv files accepted</p>
            </div>

            {selectedFile && (
              <div className="mt-4 rounded-lg border border-border-base bg-bg-card2 p-3">
                <p className="text-sm text-text-primary">{selectedFile.name}</p>
                <p className="text-xs text-text-secondary">{formatBytes(selectedFile.size)}</p>
              </div>
            )}

            {(isUploading || progress > 0) && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                  <span>Upload Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-card2">
                  <div
                    className="h-2 rounded-full bg-accent-blue transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-xs text-accent-red">{error}</p>}

            <div className="mt-4">
              <Button disabled={!tier || !selectedFile || isUploading} onClick={handleUpload}>
                {isUploading ? "Uploading..." : "Upload CSV"}
              </Button>
            </div>
          </Card>

          <Card
            accentColor="#10b981"
            subtitle="Detected columns mapped to canonical schema"
            title="Column Detection Result"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REQUIRED_CANONICAL.map((item) => {
                const mappedHeader = detectedMap[item.key];
                const found = Boolean(mappedHeader);
                return (
                  <div
                    className="rounded-md border border-border-base bg-bg-card2 px-3 py-2 text-sm"
                    key={item.key}
                  >
                    <span className={found ? "text-accent-green" : "text-text-secondary"}>
                      {found ? "✓" : "—"}{" "}
                    </span>
                    <span className="text-text-primary">{item.label}</span>
                    {found ? <span className="text-text-secondary"> ({mappedHeader})</span> : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              Detected {matchedCount} of {REQUIRED_CANONICAL.length} columns. Dashboard ready.
            </p>
            {uploadedId && (
              <div className="mt-4">
                <Link to={`/dashboard?uploadId=${uploadedId}`}>
                  <Button>View Dashboard →</Button>
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
