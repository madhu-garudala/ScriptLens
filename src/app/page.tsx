import Link from "next/link";
import Image from "next/image";
import manifest from "@/data/fixture-manifest.json";
import { UploadCard } from "@/components/UploadCard";

export default function QueuePage() {
  const fixtures = manifest.fixtures;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold t-strong">Prescription Intake</h1>
          <p className="mt-1 text-sm t-dim">
            Incoming faxes awaiting extraction and pharmacist review. All examples are
            synthetic.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border bordered panel shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bordered panel-muted text-left text-xs uppercase tracking-wide t-dim">
              <th className="px-4 py-2.5">Fax</th>
              <th className="px-4 py-2.5">Source ID</th>
              <th className="px-4 py-2.5">Scenario</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f) => (
              <tr key={f.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <div className="relative h-16 w-12 overflow-hidden rounded border bordered bg-white">
                    <Image src={f.image} alt={`${f.id} preview`} fill className="object-cover object-top" />
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs t-body">{f.id}</td>
                <td className="px-4 py-3">
                  <div className="font-medium t-strong">{f.title}</div>
                  <div className="text-xs t-dim">{f.description}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="badge badge-ai">Not processed</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/review/${f.id}`} className="btn btn-primary">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <UploadCard />
      </div>
    </div>
  );
}
