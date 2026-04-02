/** Collapse = chevron left; expand = chevron right (play-style open). */
export function SidebarToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      {expanded ? (
        <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
      ) : (
        <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
      )}
    </svg>
  );
}
