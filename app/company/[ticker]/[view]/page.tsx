import { notFound } from "next/navigation";
import Comps from "@/components/views/Comps";
import Filings from "@/components/views/Filings";
import Financials from "@/components/views/Financials";
import Ratios from "@/components/views/Ratios";
import Report from "@/components/views/Report";
import Risk from "@/components/views/Risk";
import Segments from "@/components/views/Segments";
import Technicals from "@/components/views/Technicals";
import Valuation from "@/components/views/Valuation";

const VIEWS = { financials: Financials, segments: Segments, filings: Filings, ratios: Ratios, valuation: Valuation, comps: Comps, risk: Risk, technicals: Technicals, report: Report } as const;

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const View = VIEWS[view as keyof typeof VIEWS];
  if (!View) notFound();
  return <View />;
}
