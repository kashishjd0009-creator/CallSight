import { describe, expect, it } from "vitest";

import { ColumnDetector } from "../column-detector.js";

describe("ColumnDetector", () => {
  it("maps exact known headers", () => {
    const detector = new ColumnDetector();
    const map = detector.detect(["Agent Name", "Talk Time", "Call Queue", "Date/Time"]);
    expect(map.agentName).toBe("Agent Name");
    expect(map.talkTime).toBe("Talk Time");
    expect(map.queue).toBe("Call Queue");
    expect(map.dateTime).toBe("Date/Time");
  });

  it("maps fuzzy headers above threshold", () => {
    const detector = new ColumnDetector();
    const map = detector.detect(["Agent Nme", "Call Durtion", "Queu"]);
    expect(map.agentName).toBe("Agent Nme");
    expect(map.talkTime).toBe("Call Durtion");
    expect(map.queue).toBe("Queu");
  });

  it("leaves unknown headers unmapped", () => {
    const detector = new ColumnDetector();
    const map = detector.detect(["Totally Unknown"]);
    expect(Object.keys(map)).toHaveLength(0);
  });
});
