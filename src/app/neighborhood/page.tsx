import type { Metadata } from "next";
import { FundPage } from "@/components/FundPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Neighborhood" };

export default function Page() {
  return <FundPage kind="neighborhood" />;
}
