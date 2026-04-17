"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import {
  useMatches,
  usePlayers,
  useRounds,
  useTournament,
} from "@/lib/firebase/db";
import { ArrowLeft } from "lucide-react";

export default function SchedulePage() {
  const { item: tournament } = useTournament();
  const { items: rounds } = useRounds();
  const { items: matches } = useMatches();
  const { items: players } = usePlayers();

  const playerMap = useMemo(() => {
    const m = new Map<string, (typeof players)[number]>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        <div>
          <Link href="/tournament" className="inline-flex items-center gap-1 text-sm text-muted">
            <ArrowLeft size={14} /> Tournament
          </Link>
          <h1 className="font-display text-3xl mt-2">Full schedule</h1>
          <p className="text-sm text-muted">
            {tournament?.totalRounds ?? 0} rounds · {tournament?.courts ?? 0} courts
          </p>
        </div>

        {rounds.length === 0 && (
          <div className="card p-6 text-center">
            <p className="font-display text-xl">Schedule drops at tip-off</p>
            <p className="text-sm text-muted mt-1">
              Pairings are generated round-by-round, Americano style.
            </p>
          </div>
        )}

        {rounds.map((r) => {
          const rm = matches
            .filter((m) => m.roundId === r.id)
            .sort((a, b) => a.court - b.court);
          return (
            <section key={r.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-xl">Round {r.number}</p>
                <span className={`chip ${r.status === "completed" ? "chip-turf" : r.status === "live" ? "chip-turf" : ""}`}>
                  {r.status}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {rm.map((m) => {
                  const a = m.teamA.map((id) => playerMap.get(id));
                  const b = m.teamB.map((id) => playerMap.get(id));
                  return (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] uppercase tracking-widest text-muted w-14">
                        Court {m.court}
                      </span>
                      <div className="flex items-center gap-1 flex-1">
                        {a.map((p, i) => (
                          <Avatar key={i} name={p?.name ?? ""} photoURL={p?.photoURL} size={24} />
                        ))}
                        <span className="text-[10px] ml-1 truncate">
                          {a.map((p) => p?.name.split(" ")[0]).join(" & ")}
                        </span>
                      </div>
                      <span className="font-mono font-bold">
                        {m.scoreA ?? "–"}:{m.scoreB ?? "–"}
                      </span>
                      <div className="flex items-center gap-1 flex-1 justify-end">
                        <span className="text-[10px] mr-1 truncate text-right">
                          {b.map((p) => p?.name.split(" ")[0]).join(" & ")}
                        </span>
                        {b.map((p, i) => (
                          <Avatar key={i} name={p?.name ?? ""} photoURL={p?.photoURL} size={24} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {r.resting?.length > 0 && (
                  <p className="text-[11px] text-muted border-t border-black/5 pt-2">
                    Resting:{" "}
                    {r.resting
                      .map((id) => playerMap.get(id)?.name.split(" ")[0] ?? "?")
                      .join(", ")}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </main>
      <BottomNav />
    </div>
  );
}
