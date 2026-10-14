"use client";

// One component for every live value: a fixed-width mono slot that re-renders on a timer,
// with the exact time on hover. Never a string written once.
import { useEffect, useState, useSyncExternalStore } from "react";
import { ago, until, clock, fmtExact } from "@/lib/format";

const subs30 = new Set<() => void>();
const subs1 = new Set<() => void>();
let t30: ReturnType<typeof setInterval> | null = null;
let t1: ReturnType<typeof setInterval> | null = null;
let now30 = 0;
let now1 = 0;

function sub(set: Set<() => void>, which: 30 | 1) {
  return (cb: () => void) => {
    set.add(cb);
    if (which === 30 && !t30) {
      now30 = Date.now();
      t30 = setInterval(() => {
        now30 = Date.now();
        subs30.forEach((f) => f());
      }, 30_000);
    }
    if (which === 1 && !t1) {
      now1 = Date.now();
      t1 = setInterval(() => {
        now1 = Date.now();
        subs1.forEach((f) => f());
      }, 1_000);
    }
    return () => {
      set.delete(cb);
    };
  };
}
const sub30 = sub(subs30, 30);
const sub1 = sub(subs1, 1);

/** Current time, refreshed every 30 s (or every second with fast=true). Server render uses `initial`. */
export function useNow(fast = false, initial?: number): number {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const v = useSyncExternalStore(
    fast ? sub1 : sub30,
    () => {
      if (fast) return now1 || (now1 = Date.now());
      return now30 || (now30 = Date.now());
    },
    () => initial ?? 0,
  );
  return mounted ? v : (initial ?? v);
}

type D = Date | string | number | null | undefined;

function Slot({ text, title, ch, left, testid }: { text: string; title?: string; ch: number; left?: boolean; testid?: string }) {
  return (
    <span className={"live-v" + (left ? " l" : "")} style={{ minWidth: `${ch}ch` }} title={title} data-live={testid || "1"} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function Ago({ date, ch = 8, prefix = "" }: { date: D; ch?: number; prefix?: string }) {
  const now = useNow(false);
  if (!date) return null;
  return <Slot text={prefix + (now ? ago(date, now) : "")} title={fmtExact(date)} ch={ch} left testid="ago" />;
}

export function Until({ date, ch = 9 }: { date: D; ch?: number }) {
  const now = useNow(false);
  if (!date) return null;
  return <Slot text={now ? until(date, now) : ""} title={fmtExact(date)} ch={ch} left testid="until" />;
}

/** A running m:ss clock since `since`. */
export function Clock({ since, ch = 5 }: { since: D; ch?: number }) {
  const now = useNow(true);
  if (!since) return null;
  const t = new Date(since).getTime();
  return <Slot text={now ? clock((now - t) / 1000) : "0:00"} ch={ch} testid="clock" />;
}

/** "No update for 12m" once the last update is older than 10 minutes. */
export function StaleLine({ updatedAt, running }: { updatedAt: D; running: boolean }) {
  const now = useNow(true);
  if (!running || !updatedAt || !now) return null;
  const age = now - new Date(updatedAt).getTime();
  if (age < 10 * 60 * 1000) return null;
  return (
    <span className="stale" data-testid="stale">
      No update for <Slot text={clock(age / 1000)} ch={6} left />
    </span>
  );
}
