import type { Metadata } from "next";
import { filingRows } from "@/lib/queries";
import { FilingRow } from "@/components/rows";
import { RowFilter } from "@/components/ListHead";
import { AREA_LABEL } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Throw Some D's on it" };

export default async function Page() {
  const rows = await filingRows();
  const areas = Object.entries(AREA_LABEL).map(([key, label]) => ({ key, label, n: rows.filter((r) => r.thesisArea === key).length }));
  return (
    <div>
      <div className="ph">
        <h1>Throw Some D&apos;s on It</h1>
        <span className="count">{rows.length} Form D and Form C filings inside the thesis · newest first</span>
      </div>
      <p className="ph-lede">
        Every day Scout reads the SEC&apos;s daily filing index, drops pooled funds, real estate, oil and gas and banking, and keeps the companies inside the thesis by industry group, name, website and keyword
        rules. &quot;Before any press&quot; means a news search finds nothing on the name yet.
      </p>
      <RowFilter placeholder="Search filings" areas={areas} target="#filings" />
      <div className="list" id="filings">
        {rows.map((f) => (
          <div key={f.id} data-filter={`${f.issuer} ${f.related.join(" ")}`} data-area={f.thesisArea || ""}>
            <FilingRow f={f} />
          </div>
        ))}
      </div>
    </div>
  );
}
