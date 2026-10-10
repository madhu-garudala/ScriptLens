import type { Metadata } from "next";
import Link from "next/link";
import { SessionUploads } from "@/components/SessionUploads";
import { UploadCard } from "@/components/UploadCard";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Upload a fax — ScriptLens" };

export default function UploadPage() {
  return <div className="page-container fade-up"><div className="page-heading"><div><p className="eyebrow">A CLEARER START</p><h1>Bring your fax into focus.</h1><p>Upload a synthetic prescription image. We’ll help you review every detail.</p></div></div><div className="upload-layout"><div><UploadCard /><SessionUploads /></div><aside className="upload-guide"><span className="guide-icon"><Icon name="lens" size={26} /></span><h2>From image to reviewed draft</h2><ol>{[["Upload your document", "Choose a clear image of a synthetic fax."], ["Extract the details", "Start extraction when you’re ready. Unclear values are flagged for review."], ["Review, then export", "Compare each required field with the original and confirm it yourself."]].map(([title, body], i) => <li key={title}><span>{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol><div className="upload-privacy"><Icon name="shield" size={18} /><p>Uploads stay in this browser tab and clear when it closes. The image is sent to the vision model only when you run extraction.</p></div></aside></div><div className="sample-invite"><span><strong>Just exploring?</strong> There’s a full set of synthetic faxes ready to review.</span><Link href="/queue">Explore the intake queue<Icon name="arrow" size={16} /></Link></div></div>;
}
