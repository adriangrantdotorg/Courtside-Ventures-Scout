import type { Metadata } from "next";
import { Today } from "../today";

// Today without the Building page, for checking the dashboard while the build is still running.
export const revalidate = 300;
export const metadata: Metadata = { title: "Today", robots: { index: false } };

export default function Page() {
  return <Today />;
}
