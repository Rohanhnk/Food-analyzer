import { notFound } from "next/navigation";
import { TrackerApp, type Section } from "@/features/tracker-app";
const sections = ["add", "history", "recipes", "goals", "insights"];
export function generateStaticParams() { return sections.map(section => ({ section })); }
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <TrackerApp section={section as Section} />;
}
