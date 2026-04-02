export function parseTimeToSeconds(raw: string): number {
  const value = raw.trim();
  if (!value) {
    return 0;
  }

  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 3) {
      const hours = Number.parseInt(parts[0] ?? "0", 10) || 0;
      const minutes = Number.parseInt(parts[1] ?? "0", 10) || 0;
      const seconds = Number.parseInt(parts[2] ?? "0", 10) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  if (value.includes(":")) {
    const parts = value.split(":");
    if (parts.length === 3) {
      const hours = Number.parseInt(parts[0] ?? "0", 10) || 0;
      const minutes = Number.parseInt(parts[1] ?? "0", 10) || 0;
      const seconds = Number.parseInt(parts[2] ?? "0", 10) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
    if (parts.length === 2) {
      const minutes = Number.parseInt(parts[0] ?? "0", 10) || 0;
      const seconds = Number.parseInt(parts[1] ?? "0", 10) || 0;
      return minutes * 60 + seconds;
    }
  }

  return 0;
}
