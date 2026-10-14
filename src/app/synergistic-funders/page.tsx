import type { Metadata } from "next";
import { FundPage } from "@/components/FundPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Synergistic Funders" };

export default function Page() {
  return <FundPage kind="synergistic" />;
}
