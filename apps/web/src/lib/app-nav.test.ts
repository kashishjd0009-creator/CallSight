import { describe, expect, it } from "vitest";

import { buildSidebarNavItems, sidebarHeaderSubtitle } from "./app-nav.js";

describe("buildSidebarNavItems", () => {
  it("includes Probe Viewer when showProbe is true", () => {
    const items = buildSidebarNavItems(true);
    expect(items.map((i) => i.id)).toEqual(["upload", "dashboard", "probe", "settings"]);
  });

  it("omits Probe Viewer when showProbe is false", () => {
    const items = buildSidebarNavItems(false);
    expect(items.map((i) => i.id)).toEqual(["upload", "dashboard", "settings"]);
  });
});

describe("sidebarHeaderSubtitle", () => {
  it("returns Menu & filters when dashboard filters are present", () => {
    expect(sidebarHeaderSubtitle(true)).toBe("Menu & filters");
  });

  it("returns Menu when no filters", () => {
    expect(sidebarHeaderSubtitle(false)).toBe("Menu");
  });
});
