"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const LINKS = [
  { href: "/", label: "Overview", icon: "grid" },
  { href: "/queue", label: "Intake queue", icon: "inbox" },
  { href: "/upload", label: "Upload a fax", icon: "upload" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return <nav className="primary-nav" aria-label="Primary navigation">
    {LINKS.map(({ href, label, icon }) => {
      const active = pathname === href || (href === "/queue" && pathname.startsWith("/review/") && pathname !== "/review/upload") || (href === "/upload" && pathname === "/review/upload");
      return <Link key={href} href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={`nav-link ${active ? "active" : ""}`}><Icon name={icon} size={19} /><span>{label}</span>{active && <span className="nav-dot" />}</Link>;
    })}
  </nav>;
}
