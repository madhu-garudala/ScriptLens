import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScriptLens — Evidence-First Prescription Intake",
  description:
    "Turns blurry synthetic prescription faxes into reviewable draft orders with visible evidence and human confirmation for every critical field.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="flex min-h-screen">
          <aside className="hidden w-56 shrink-0 flex-col bg-shell text-slate-300 lg:flex">
            <div className="px-5 py-6">
              <Link href="/" className="block">
                <div className="text-lg font-bold text-white">
                  Script<span className="text-teal-300">Lens</span>
                </div>
                <div className="mt-1 text-[11px] leading-snug text-slate-400">
                  See the evidence behind every prescription.
                </div>
              </Link>
            </div>
            <nav className="flex-1 space-y-1 px-3 text-sm">
              <Link
                href="/"
                className="block rounded-md px-3 py-2 font-medium text-white hover:bg-white/10"
              >
                Intake Queue
              </Link>
              <div className="px-3 py-2 text-slate-500">Reliability — in review panel</div>
            </nav>
            <div className="px-5 py-5 text-[10px] leading-relaxed text-slate-500">
              Hackathon prototype.
              <br />
              Nothing here transmits, fills, or approves a prescription.
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-3 border-b bordered panel px-4 py-2.5 lg:px-6">
              <div className="text-sm font-semibold t-body lg:hidden">ScriptLens</div>
              <div className="text-xs t-dim">
                Get Hired Hack · Track 4 · PillSpark — Fax to Fill
              </div>
              <div className="flex items-center gap-2"><span className="badge badge-missing">Synthetic data · demo only</span><ThemeToggle /></div>
            </header>
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
