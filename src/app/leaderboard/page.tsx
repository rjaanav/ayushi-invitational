"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import { usePlayers, useTournament } from "@/lib/firebase/db";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { items: players } = usePlayers();
  const { item: tournament } = useTournament();
  const { player: me } = useAuth();

  const ranked = players
    .filter((p) => p.name)
    .slice()
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = (a.pointsFor ?? 0) - (a.pointsAgainst ?? 0);
      const diffB = (b.pointsFor ?? 0) - (b.pointsAgainst ?? 0);
      return diffB - diffA;
    });

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <header>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            Scoreboard
          </p>
          <h1 className="font-display text-3xl">Who&rsquo;s cooking 🔥</h1>
          <p className="text-sm text-muted mt-1">
            {tournament?.status === "live"
              ? `Round ${tournament.currentRound} of ${tournament.totalRounds} · updates live`
              : "Updates live as scores come in."}
          </p>
        </header>

        {top3.length > 0 && (
          <div className="relative card p-6 pb-8 bg-gradient-to-br from-court-800 via-court-700 to-court-600 text-white overflow-hidden">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pink-400/30 blur-2xl" />
            <div className="grid grid-cols-3 gap-2 items-end">
              {[top3[1], top3[0], top3[2]].map((p, idx) => {
                if (!p) return <div key={idx} />;
                const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                const heights = { 1: 140, 2: 110, 3: 90 } as const;
                return (
                  <div key={p.id} className="flex flex-col items-center gap-2">
                    <Avatar
                      name={p.name}
                      photoURL={p.photoURL}
                      size={rank === 1 ? 72 : 56}
                      ring
                    />
                    <p className="font-semibold text-sm truncate max-w-[6rem] text-center">
                      {p.name.split(" ")[0]}
                    </p>
                    <div
                      className={cn(
                        "w-full rounded-t-2xl flex flex-col items-center justify-start pt-3 text-center",
                        rank === 1 && "bg-pink-300 text-court-900",
                        rank === 2 && "bg-turf-400 text-court-900",
                        rank === 3 && "bg-sand text-court-900"
                      )}
                      style={{ height: heights[rank as 1 | 2 | 3] }}
                    >
                      {rank === 1 && <Crown size={18} className="mb-1" />}
                      <p className="font-display text-2xl">{p.points}</p>
                      <p className="text-[10px] uppercase tracking-widest opacity-80">
                        #{rank}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card p-1">
          {rest.length === 0 && top3.length === 0 && (
            <p className="p-6 text-sm text-muted text-center">
              Leaderboard comes alive once matches begin.
            </p>
          )}
          {[...top3, ...rest].slice(top3.length === 0 ? 0 : 3).map((p, idx) => {
            const rank = idx + 4;
            const isMe = p.id === me?.id;
            return (
              <motion.div
                key={p.id}
                layout
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                  isMe && "bg-pink-100/60"
                )}
              >
                <span className="w-7 text-center font-display text-lg text-court-800">
                  {rank}
                </span>
                <Link href={`/players/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={p.name} photoURL={p.photoURL} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {p.name}
                      {isMe && <span className="chip ml-2 !py-0 !px-1.5 !text-[10px]">you</span>}
                      {p.isAyushi && <span className="chip chip-turf ml-2 !py-0 !px-1.5 !text-[10px]">👑 birthday</span>}
                    </p>
                    <p className="text-[11px] text-muted">
                      {p.matchesPlayed ?? 0} played · {p.wins ?? 0}W-{p.losses ?? 0}L · diff {(p.pointsFor ?? 0) - (p.pointsAgainst ?? 0) >= 0 ? "+" : ""}
                      {(p.pointsFor ?? 0) - (p.pointsAgainst ?? 0)}
                    </p>
                  </div>
                </Link>
                <span className="font-mono font-bold text-court-800 tabular-nums">
                  {p.points}
                </span>
              </motion.div>
            );
          })}
        </div>

        <Link href="/tournament" className="btn btn-primary">
          <Trophy size={16} /> Back to tournament
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
