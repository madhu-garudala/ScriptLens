import type { Metadata } from "next";
import manifest from "@/data/fixture-manifest.json";
import { IntakeQueue } from "@/components/IntakeQueue";

export const metadata: Metadata = { title: "Intake queue — ScriptLens" };

export default function QueuePage() {
  return <div className="page-container fade-up"><div className="page-heading"><div><p className="eyebrow">ONE DOCUMENT AT A TIME</p><h1>Intake queue</h1><p>A clear view of what’s next. Open a fax to begin or continue your review.</p></div></div><IntakeQueue faxes={manifest.fixtures.map(({ id, title, image, description }) => ({ id, title, image, description }))} /><p className="page-footnote">All queue documents are synthetic examples. Completed reviews remain available in the Processed tab.</p></div>;
}
