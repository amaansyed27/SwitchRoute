import type { SVGProps } from "react";

type IconName = "home" | "providers" | "waterfall" | "key" | "activity" | "docs" | "sun" | "moon" | "system" | "logout" | "plus" | "refresh" | "trash" | "search" | "copy" | "x" | "chevron" | "grip" | "external" | "check";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
  providers: <><path d="M7 2v5"/><path d="M17 2v5"/><path d="M5 7h14v5a7 7 0 0 1-14 0Z"/><path d="M12 19v3"/></>,
  waterfall: <><path d="M4 5h10"/><path d="M10 2l4 3-4 3"/><path d="M20 12H10"/><path d="m14 9-4 3 4 3"/><path d="M4 19h10"/><path d="m10 16 4 3-4 3"/></>,
  key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m16 7 2 2"/><path d="m18 5 2 2"/></>,
  activity: <><path d="M4 19V5"/><path d="M8 16v-5"/><path d="M12 18V8"/><path d="M16 14V6"/><path d="M20 19V3"/></>,
  docs: <><path d="M5 3h10l4 4v14H5Z"/><path d="M15 3v5h5"/><path d="M8 12h8M8 16h8"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>,
  system: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18h-6"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.9-4"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.9 4"/><path d="M20 21v-5h-5"/></>,
  trash: <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  x: <path d="M6 6l12 12M18 6 6 18"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  grip: <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
  external: <><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
