export type SidebarNavItem = {
  id: "upload" | "dashboard" | "probe" | "settings";
  to: string;
  label: string;
};

/**
 * Ordered primary nav for the authenticated app shell. Probe appears only when allowed.
 */
export function buildSidebarNavItems(showProbe: boolean): SidebarNavItem[] {
  const items: SidebarNavItem[] = [
    { id: "upload", to: "/upload", label: "Upload CSV" },
    { id: "dashboard", to: "/dashboard", label: "Dashboard" },
  ];
  if (showProbe) {
    items.push({ id: "probe", to: "/probe", label: "Probe Viewer" });
  }
  items.push({ id: "settings", to: "/settings", label: "Settings" });
  return items;
}

export function sidebarHeaderSubtitle(hasFilters: boolean): string {
  return hasFilters ? "Menu & filters" : "Menu";
}
