import Link from "next/link";
import manifest from "@/data/fixture-manifest.json";
import { IntakeQueue } from "@/components/IntakeQueue";
import { Icon } from "@/components/Icon";

export default function HomePage() {
  return <div className="page-container fade-up">
    <div className="page-heading"><div><p className="eyebrow">YOUR REVIEW WORKSPACE</p><h1>A little clarity. A better workflow.</h1><p>Turn incoming faxes into drafts you can confidently verify.</p></div></div>
    <section className="welcome-banner">
      <div className="welcome-copy"><span className="welcome-kicker"><span /> EVIDENCE-FIRST INTAKE</span><h2>From fax to facts.<br /><span>With you in control.</span></h2><p>Read the source. Resolve the uncertainty.<br />Give every prescription the review it deserves.</p><Link href="/queue" className="btn btn-banner">Start reviewing<Icon name="arrow" size={17} /></Link></div>
      <div className="workflow-illustration" aria-hidden="true"><div className="illustration-orbit" /><div className="paper-preview"><div className="paper-cross">+</div><span className="paper-label">PRESCRIPTION</span><div className="paper-rule" /><div className="paper-lines"><i /><i /><i /><i /></div><span className="paper-rx">℞</span><div className="paper-highlight" /><div className="paper-lines short"><i /><i /></div></div><div className="verified-preview"><span className="verified-icon"><Icon name="check" size={17} /></span><div>Evidence in every field<small>Ready for your review</small></div></div><span className="floating-lens"><Icon name="lens" size={29} /></span></div>
    </section>
    <IntakeQueue faxes={manifest.fixtures.map(({ id, title, image, description }) => ({ id, title, image, description }))} compact />
    <div className="principle-strip"><span><Icon name="file" size={17} />Source evidence for every field</span><span><Icon name="shield" size={17} />Unknown stays unknown</span><span><Icon name="check" size={17} />Human-confirmed export</span></div>
    <p className="page-footnote">Built for careful review. Demo only — no prescription is transmitted, filled, or approved.</p>
  </div>;
}
