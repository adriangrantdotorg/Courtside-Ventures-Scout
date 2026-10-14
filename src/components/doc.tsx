"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Printer, Send } from "lucide-react";
import { useUI } from "./ui";
import { postJSON } from "@/lib/client";

/** The Document template's head tools: Print and Share to Slack. */
export function DocTools({ slackText }: { slackText: string }) {
  const ui = useUI();
  async function share() {
    const r = await postJSON("/api/slack/test", { text: `${slackText} ${location.href}` });
    if (r.status === 409) return ui.error("Slack isn't connected yet", "Connect Slack once in Settings › Slack, then share from here.", { label: "Open Settings › Slack", href: "/settings?s=slack" });
    if (!r.ok) return ui.error("Slack didn't take the post", r.error || "The server did not answer.");
    ui.toast("Shared to Slack");
  }
  return (
    <div className="tools2">
      <button className="btn" onClick={() => window.print()} title="Print this page, or save it as a PDF">
        <Printer className="ico" />
        Print
      </button>
      <button className="btn" onClick={share} title="Post a link to this page in the connected Slack channel">
        <Send className="ico" />
        Share to Slack
      </button>
    </div>
  );
}

/** "On this page": the active section marked with a red left bar as you scroll. */
export function Toc({ items }: { items: { id: string; label: string }[] }) {
  const [on, setOn] = useState(items[0]?.id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => {
        const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setOn(vis.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    items.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [items]);
  return (
    <nav className="toc" aria-label="On this page">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className={on === i.id ? "on" : ""}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

export function DocHead({ label, title, lede, slackText }: { label: string; title: string; lede: ReactNode; slackText: string }) {
  return (
    <>
      <header className="pgh">
        <div>
          <span className="label">{label}</span>
          <h1>{title}</h1>
          <p className="lede2">{lede}</p>
        </div>
        <DocTools slackText={slackText} />
      </header>
      <div className="rule" />
    </>
  );
}
