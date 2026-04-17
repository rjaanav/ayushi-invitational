"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import {
  useMatches,
  usePlayers,
  useSuperlatives,
} from "@/lib/firebase/db";
import { Trophy } from "lucide-react";

export default function AwardsPage() {
  const { items: superlatives } = useSuperlatives();
  const { items: players } = usePlayers();
  const { items: matches } = useMatches();

  const mvpCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    matches.forEach((m) => {
      Object.values(m.mvpVotes ?? {}).forEach((pid) => {
        counts[pid] = (counts[pid] ?? 0) + 1;
      });
    });
    return counts;
  }, [matches]);

  const topMvp = useMemo(() => {
    const entries = Object.entries(mvpCounts).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 3);
  }, [mvpCounts]);

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <header>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            Hall of Fame
          </p>
          <h1 className="font-display text-3xl">
            The <span className="text-pink-500">superlatives</span> 🏆
          </h1>
          <p className="text-sm text-muted mt-1">
            Silly, serious, and everything in between.
          </p>
        </header>

        {topMvp.length > 0 && (
          <section className="card p-4 bg-gradient-to-br from-pink-200 to-white">
            <p className="text-xs uppercase tracking-wider font-bold text-court-800 mb-3">
              🏅 Most MVP votes
            </p>
            <div className="flex flex-col gap-2">
              {topMvp.map(([pid, count], idx) => {
                const p = players.find((x) => x.id === pid);
                if (!p) return null;
                return (
                  <motion.div
                    key={pid}
                    layout
                    className="flex items-center gap-3"
                  >
                    <span className="font-display text-lg w-6 text-center">
                      {idx + 1}
                    </span>
                    <Avatar name={p.name} photoURL={p.photoURL} size={34} />
                    <p className="font-semibold text-sm flex-1 truncate">
                      {p.name}
                    </p>
                    <span className="font-mono text-sm">{count} votes</span>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {superlatives.length === 0 && (
          <div className="card p-6 text-center">
            <Trophy className="mx-auto text-court-700 mb-2" />
            <p className="font-display text-xl">
              Awards drop throughout the night
            </p>
            <p className="text-sm text-muted mt-1">
              Admin can create new ones anytime.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {superlatives.map((s) => {
            const winner = players.find((p) => p.id === s.winnerId);
            return (
              <motion.div
                layout
                key={s.id}
                className="card p-4 flex items-center gap-4 relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #fff3f6 60%, #ffe1e9 100%)",
                }}
              >
                <div className="absolute -right-3 -bottom-3 text-6xl opacity-10">
                  {s.icon ?? "🏆"}
                </div>
                <div className="text-3xl">{s.icon ?? "🏆"}</div>
                <div className="flex-1 relative">
                  <p className="font-display text-lg leading-tight">
                    {s.title}
                  </p>
                  {winner ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Avatar
                        name={winner.name}
                        photoURL={winner.photoURL}
                        size={24}
                      />
                      <p className="text-sm font-semibold">{winner.name}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted mt-1">
                      Winner TBD — stay tuned 👀
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
