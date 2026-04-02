import { describe, expect, it } from "vitest";

import { parseTimeToSeconds } from "../time-parser.js";

describe("parseTimeToSeconds", () => {
  it("parses HH.MM.SS format", () => {
    expect(parseTimeToSeconds("0.02.30")).toBe(150);
  });

  it("parses HH:MM:SS format", () => {
    expect(parseTimeToSeconds("00:02:30")).toBe(150);
  });

  it("parses MM:SS format", () => {
    expect(parseTimeToSeconds("2:30")).toBe(150);
  });

  it("parses integer seconds string", () => {
    expect(parseTimeToSeconds("150")).toBe(150);
  });

  it("returns zero for empty string", () => {
    expect(parseTimeToSeconds("")).toBe(0);
  });

  it("returns zero for 0.00.00", () => {
    expect(parseTimeToSeconds("0.00.00")).toBe(0);
  });
});
