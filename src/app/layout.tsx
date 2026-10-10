import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Icon } from "@/components/Icon";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "ScriptLens — Evidence-First Prescription Intake",
  description: "Prescription intake with visible source evidence and human confirmation for every critical field.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <div className="app-shell">
          <aside className="sidebar">
            <Link href="/" className="brand" aria-label="ScriptLens home"><span className="brand-mark"><Icon name="lens" size={24} /></span><span>ScriptLens<span className="brand-caption">PRESCRIPTION INTAKE</span></span></Link>
            <div className="nav-caption">WORKSPACE</div>
            <NavLinks />
            <div className="sidebar-bottom">
              <div className="sidebar-note"><Icon name="shield" size={21} /><strong>Every detail. Verified.</strong><p>Source evidence and human review, at every step.</p></div>
              <div className="reviewer"><span className="reviewer-avatar">DR</span><div>Demo reviewer<small>Prescription review</small></div><ThemeToggle /></div>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar"><span>Workspace <span className="topbar-slash">/</span> <strong>Prescription intake</strong></span><span className="demo-label"><span /> Synthetic data only</span></header>
            <main id="main-content" className="main-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
