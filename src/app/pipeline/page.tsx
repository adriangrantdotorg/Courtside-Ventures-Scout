import { Suspense } from "react";
import type { Metadata } from "next";
import { companyCards } from "@/lib/queries";
import { getThreshold } from "@/lib/settings";
import { PipelineView } from "@/components/Pipeline";

export const revalidate = 300;
export const metadata: Metadata = { title: "Pipeline" };

export default async function Page() {
  const [cards, threshold] = await Promise.all([companyCards("thesis"), getThreshold()]);
  return (
    <Suspense>
      <PipelineView cards={cards} threshold={threshold} />
    </Suspense>
  );
}
