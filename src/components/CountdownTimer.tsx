"use client";

import { useEffect, useState } from "react";
import { formatClock, pad } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
  target: Date;
  label?: string;
  compact?: boolean;
}

export function CountdownTimer({ target, label, compact }: Props) {
  // Don't read the clock during SSR — it'll drift before hydration.
  // Render neutral placeholders on the server + first client render,
  // then swap to the real countdown after mount.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const mounted = now !== null;
  const diff = mounted ? target.getTime() - now : 0;
  const { days, hours, minutes, seconds } = formatClock(mounted ? diff : 0);
  const live = mounted && diff <= 0;

  if (compact) {
    return (
      <span className="font-mono text-sm tracking-tight" suppressHydrationWarning>
        {!mounted
          ? "—"
          : live
            ? "LIVE"
            : `${pad(days)}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`}
      </span>
    );
  }

  if (live) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-3xl font-display text-pink-500"
        >
          It&rsquo;s time. 🎾✨
        </motion.div>
        <p className="text-sm text-ink-soft/70">Happy birthday, Ayushi.</p>
      </div>
    );
  }

  const segments = [
    { label: "DAYS", value: days },
    { label: "HOURS", value: hours },
    { label: "MINUTES", value: minutes },
    { label: "SECONDS", value: seconds },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-[11px] uppercase tracking-[0.3em] text-court-700 font-semibold">
          {label}
        </p>
      )}
      <div className="grid grid-cols-4 gap-2 w-full">
        {segments.map((s) => (
          <div
            key={s.label}
            className="card py-3 px-1 flex flex-col items-center"
          >
            <motion.span
              key={mounted ? s.value : "placeholder"}
              initial={mounted ? { y: -6, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              className="font-display text-2xl sm:text-3xl text-court-800 tabular-nums"
              suppressHydrationWarning
            >
              {mounted ? pad(s.value) : "–"}
            </motion.span>
            <span className="text-[10px] tracking-[0.2em] text-muted mt-0.5">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
