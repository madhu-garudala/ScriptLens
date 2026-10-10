import { notFound } from "next/navigation";
import manifest from "@/data/fixture-manifest.json";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";

export function generateStaticParams() {
  return [...manifest.fixtures.map((f) => ({ id: f.id })), { id: "upload" }];
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  const fixture = manifest.fixtures.find((f) => f.id === params.id) ?? null;
  if (!fixture && params.id !== "upload") notFound();
  return (
    <ReviewWorkspace
      documentId={params.id}
      fixtureImage={fixture?.image ?? null}
      fixtureTitle={fixture?.title ?? "Uploaded fax"}
    />
  );
}
