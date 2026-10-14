import { buildProgress } from "@/lib/queries";
import { Building } from "@/components/Building";
import { Today } from "./today";

export const revalidate = 300;

export default async function Home() {
  const p = await buildProgress().catch(() => null);
  if (p && !p.done) return <Building initial={p} />;
  return <Today />;
}
