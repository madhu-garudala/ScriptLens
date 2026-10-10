"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Fax = { id: string; title: string; image: string; description: string };
type Saved = { documentId: string; exported: boolean; status: string };
type Filter = "waiting" | "review" | "processed" | "all";

export function IntakeQueue({ faxes, compact = false }: { faxes: Fax[]; compact?: boolean }) {
  const [saved, setSaved] = useState<Map<string, Saved>>(new Map());
  const [storageDown, setStorageDown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("waiting");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status === "waiting" || status === "review" || status === "processed" || status === "all") {
      setFilter(status);
    }
    let cancelled = false;
    (async () => {
      try {
        let id = localStorage.getItem("scriptlens-client");
        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem("scriptlens-client", id);
        }
        const res = await fetch("/api/reviews", { headers: { "x-scriptlens-client": id } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { reviews: Saved[] };
        if (!cancelled) setSaved(new Map(json.reviews.map((r) => [r.documentId, r])));
      } catch {
        if (!cancelled) setStorageDown(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isDone = (id: string) => {
    const s = saved.get(id);
    return !!s && (s.exported || s.status === "UNSUPPORTED");
  };
  const waiting = faxes.filter((f) => !isDone(f.id));
  const inReview = waiting.filter((f) => saved.has(f.id));
  const processed = faxes.filter((f) => isDone(f.id));
  const filtered = faxes.filter((f) => {
    const matchesStatus = filter === "all" || (filter === "waiting" && !isDone(f.id)) || (filter === "review" && !isDone(f.id) && saved.has(f.id)) || (filter === "processed" && isDone(f.id));
    return matchesStatus && `${f.title} ${f.id} ${f.description}`.toLowerCase().includes(query.toLowerCase());
  });
  const visible = filtered;
  const count = (n: number) => loading || storageDown ? "—" : n.toString().padStart(2, "0");

  return <section className="queue-section" aria-label="Fax intake">
    <div className="stats-grid">
      {([{ label: "Awaiting review", value: count(waiting.length), note: "Ready for a closer look", icon: "inbox", tone: "green", tab: "waiting" }, { label: "Review in progress", value: count(inReview.length), note: "Pick up where you left off", icon: "clock", tone: "amber", tab: "review" }, { label: "Processed documents", value: count(processed.length), note: "Reviewed and accounted for", icon: "check", tone: "purple", tab: "processed" }] as const).map((s) => {
        const content = <><div><span className="stat-label">{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></div><span className={`stat-icon ${s.tone}`}><Icon name={s.icon} size={21} /></span></>;
        return compact
          ? <Link key={s.label} href={`/queue?status=${s.tab}`} className="stat-card" aria-label={`Show ${s.label.toLowerCase()}`}>{content}</Link>
          : <button key={s.label} className="stat-card" onClick={() => setFilter(s.tab)} aria-label={`Show ${s.label.toLowerCase()}`}>{content}</button>;
      })}
    </div>
    {compact && storageDown && <p className="queue-notice" role="status">Saved review counts are unavailable. Open the intake queue to view documents.</p>}
    {!compact && <>
    <div className="section-heading"><div><h2>Incoming documents</h2><p>Find a document and take it from source to verified draft.</p></div></div>
    <div className="queue-card">
      <div className="queue-toolbar"><div className="queue-tabs" role="group" aria-label="Filter documents">
        {([{ key: "waiting", label: "Awaiting review", total: waiting.length }, { key: "review", label: "In progress", total: inReview.length }, { key: "processed", label: "Processed", total: processed.length }, { key: "all", label: "All", total: faxes.length }] as const).map((t) => <button key={t.key} className={filter === t.key ? "active" : ""} aria-pressed={filter === t.key} onClick={() => setFilter(t.key)}>{t.label}<span>{t.key === "all" ? t.total : loading || storageDown ? "—" : t.total}</span></button>)}
      </div><label className="search-field"><Icon name="search" size={17} /><input aria-label="Search documents" placeholder="Search documents…" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={14} /></button>}</label></div>
      {storageDown && <div className="queue-notice" role="status"><Icon name="alert" size={16} />Saved status is unavailable. Documents are shown without saved review progress.</div>}
      <div className="queue-table-wrap"><table className="queue-table"><thead><tr><th scope="col">DOCUMENT</th><th scope="col" className="details-column">DETAILS</th><th scope="col">STATUS</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>
        {visible.map((f) => {
          const done = isDone(f.id);
          const started = saved.has(f.id);
          const label = loading ? "Checking status" : storageDown ? "Status unavailable" : saved.get(f.id)?.exported ? "Draft exported" : done ? "Not a prescription" : started ? "In review" : "Ready to review";
          return <tr key={f.id}><td><Link href={`/review/${f.id}`} className="document-cell"><span className="document-thumbnail"><Image src={f.image} alt="" width={36} height={46} className="object-cover object-top" /></span><span><strong>{f.title}</strong><small>{f.id}</small></span></Link></td><td className="details-column"><span className="document-description">{f.description}</span></td><td><span className={`badge ${done ? "badge-confirmed" : started ? "badge-review" : "badge-ai"}`}>{label}</span></td><td><Link href={`/review/${f.id}`} className="row-action" aria-label={`${done ? "Reopen" : started ? "Continue" : "Review"} ${f.title}`}><span>{done ? "Reopen" : started ? "Continue" : "Review"}</span><Icon name="arrow" size={16} /></Link></td></tr>;
        })}
      </tbody></table></div>
      {visible.length === 0 && <div className="empty-state"><span className="empty-icon"><Icon name={query ? "search" : "inbox"} size={27} /></span><h3>{query ? "No matching documents" : filter === "processed" ? "No processed documents yet" : filter === "review" ? "No reviews in progress" : "You’re all caught up"}</h3><p>{query ? "Try another title or document ID." : filter === "processed" ? "Exported drafts and unsupported documents will appear here." : "Choose another tab to see the rest of your documents."}</p><button className="btn btn-ghost" onClick={() => { setQuery(""); setFilter("all"); }}>Show all documents</button></div>}
      <div className="table-footer"><span>{visible.length} of {filtered.length} document{filtered.length === 1 ? "" : "s"}{query ? " matching your search" : ""}</span><span><Icon name="shield" size={13} />Synthetic examples</span></div>
    </div>
    </>}
  </section>;
}
