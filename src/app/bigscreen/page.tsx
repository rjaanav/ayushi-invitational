"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Avatar } from "@/components/Avatar";
import { EVENT } from "@/lib/eventConfig";
import {
  useBirthdayMessages,
  useMatches,
  useMemories,
  usePlayers,
  useRounds,
  useTournament,
} from "@/lib/firebase/db";

/**
 * Big screen mode — designed for a TV/projector at the venue.
 * Shows live scores, leaderboard, and rotating birthday messages.
 * Use /bigscreen?layout=leaderboard to start in specific views.
 */
export default function BigScreenPage() {
  const { items: players } = usePlayers();
  const { items: matches } = useMatches();
  const { items: rounds } = useRounds();
  const { item: tournament } = useTournament();
  const { items: messages } = useBirthdayMessages();
  const { items: memories } = useMemories();

  const playerMap = useMemo(() => {
    const m = new Map<string, (typeof players)[number]>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const currentRound = rounds.find((r) => r.number === tournament?.currentRound);
  const currentMatches = matches.filter((m) => m.roundId === currentRound?.id);
  const ranked = [...players]
    .filter((p) => p.name)
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);

  const rotatingMessage =
    messages[Math.floor(Date.now() / 8000) % Math.max(1, messages.length)];

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-court-900 via-court-800 to-court-700 text-white p-8">
      <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-pink-400/30 blur-3xl" />
      <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-turf-500/20 blur-3xl" />

      <div className="relative h-full grid grid-cols-[1.6fr_1fr] gap-8">
        {/* Left column */}
        <div className="flex flex-col gap-6 overflow-hidden">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs tracking-[0.4em] uppercase opacity-70">
                THE AYUSHI INVITATIONAL
              </p>
              <h1 className="font-display text-5xl mt-1">
                {tournament?.status === "live"
                  ? `Round ${tournament.currentRound}`
                  : tournament?.status === "completed"
                    ? "🏆 Champions crowned"
                    : "Tip-off in…"}
              </h1>
            </div>
            <div>
              {tournament?.status === "live" ? (
                <span className="chip chip-turf text-base !px-4 !py-2">LIVE</span>
              ) : (
                <CountdownTimer target={EVENT.start} compact />
              )}
            </div>
          </header>

          {currentMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 flex-1 overflow-auto">
              {currentMatches.map((m) => (
                <div
                  key={m.id}
                  className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 p-5 flex items-center justify-between"
                >
                  <p className="text-xs tracking-[0.3em] uppercase opacity-60 absolute">
                    Court {m.court}
                  </p>
                  <TeamBig ids={m.teamA} playerMap={playerMap} />
                  <div className="text-center">
                    <p className="font-display text-5xl tabular-nums">
                      {m.scoreA ?? 0}
                      <span className="text-pink-300 mx-3">:</span>
                      {m.scoreB ?? 0}
                    </p>
                    <p className="text-[11px] opacity-60 tracking-widest uppercase mt-1">
                      {m.status}
                    </p>
                  </div>
                  <TeamBig ids={m.teamB} playerMap={playerMap} rightAlign />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <CountdownTimer target={EVENT.start} />
            </div>
          )}

          {/* Rotating memory strip */}
          {memories.length > 0 && (
            <div className="relative overflow-hidden h-24 rounded-2xl">
              <div className="marquee flex gap-3 absolute inset-0">
                {[...memories, ...memories].slice(0, 20).map((m, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${m.id}-${idx}`}
                    src={m.imageURL}
                    alt=""
                    className="h-24 w-24 object-cover rounded-2xl"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: leaderboard + message */}
        <div className="flex flex-col gap-5 overflow-hidden">
          <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 p-5 flex-1 overflow-auto">
            <p className="text-xs tracking-[0.3em] uppercase opacity-60 mb-3">
              Leaderboard
            </p>
            <ol className="space-y-2">
              {ranked.map((p, idx) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span
                    className={`font-display text-2xl w-8 ${
                      idx === 0
                        ? "text-pink-300"
                        : idx === 1
                          ? "text-turf-300"
                          : "text-white/70"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <Avatar name={p.name} photoURL={p.photoURL} size={38} />
                  <p className="flex-1 truncate font-semibold">{p.name}</p>
                  <span className="font-mono text-xl tabular-nums">
                    {p.points}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <AnimatePresence mode="wait">
            {rotatingMessage && (
              <motion.div
                key={rotatingMessage.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-3xl bg-pink-400/25 border border-pink-300/40 p-5"
              >
                <p className="text-xs tracking-[0.3em] uppercase opacity-80">
                  From the fam · For Ayushi
                </p>
                <p className="font-display text-2xl leading-snug mt-2">
                  &ldquo;{rotatingMessage.message}&rdquo;
                </p>
                <p className="text-sm opacity-80 mt-2">
                  — {rotatingMessage.authorName}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function TeamBig({
  ids,
  playerMap,
  rightAlign,
}: {
  ids: string[];
  playerMap: Map<string, { id: string; name: string; photoURL?: string }>;
  rightAlign?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 min-w-[14rem] ${rightAlign ? "items-end text-right" : ""}`}
    >
      {ids.map((id) => {
        const p = playerMap.get(id);
        return (
          <div
            key={id}
            className={`flex items-center gap-3 ${rightAlign ? "flex-row-reverse" : ""}`}
          >
            <Avatar name={p?.name ?? ""} photoURL={p?.photoURL} size={44} ring />
            <p className="font-semibold text-lg">{p?.name ?? "?"}</p>
          </div>
        );
      })}
    </div>
  );
}
