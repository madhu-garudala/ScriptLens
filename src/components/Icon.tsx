import type { SVGProps } from "react";

const paths = {
  lens: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM16 16l5 5M8 10.5h5M10.5 8v5",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  inbox: "M4 4h16l2 11v5H2v-5L4 4ZM2 15h6l2 3h4l2-3h6M7 8h10M8 11h8",
  upload: "M12 16V3M7 8l5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  file: "M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h5",
  arrow: "M4 12h16M14 6l6 6-6 6",
  check: "m5 12 4 4L19 6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  alert: "m12 3 10 18H2L12 3Zm0 6v5m0 3v.2",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  history: "M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l4 2",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
} as const;

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
