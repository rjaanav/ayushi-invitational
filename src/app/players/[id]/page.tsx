"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, Sparkles } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import {
  useDocument,
  useMatches,
  usePlayers,
} from "@/lib/firebase/db";
import type { Player } from "@/lib/types";
import { useAuth } from "@/lib/hooks/useAuth";

export default function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { item: p, loading } = useDocument<Player>("players", id);
  const { items: matches } = useMatches();
  const { items: all } = usePlayers();
  const { player: me, signOut } = useAuth();

  const myMatches = matches.filter(
    (m) => m.teamA.includes(id) || m.teamB.includes(id)
  );

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Link href="/players" className="inline-flex items-center gap-1 text-sm text-muted">
            <ArrowLeft size={14} /> Players
          </Link>
          {me?.id === id && (
            <button onClick={signOut} className="text-sm text-muted inline-flex items-center gap-1">
              <LogOut size={14} /> Sign out
            </button>
          )}
        </div>

        {loading || !p ? (
          <div className="skeleton h-60" />
        ) : (
          <>
            <section className="card p-6 flex flex-col items-center text-center gap-3 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-pink-200/60 to-transparent" />
              <Avatar name={p.name} photoURL={p.photoURL} size={104} ring />
              <div>
                <h1 className="font-display text-2xl">{p.name}</h1>
              </div>
              {p.funFact && (
                <p className="text-sm text-ink-soft italic max-w-xs">
                  &ldquo;{p.funFact}&rdquo;
                </p>
              )}
            </section>

            <section className="grid grid-cols-4 gap-2">
              <Stat label="Pts" value={p.points} highlight />
              <Stat label="Played" value={p.matchesPlayed} />
              <Stat label="W" value={p.wins} />
              <Stat label="L" value={p.losses} />
            </section>

            <section className="card p-4">
              <p className="text-xs uppercase tracking-wider font-bold text-court-800 mb-2">
                Match history
              </p>
              {myMatches.length === 0 && (
                <p className="text-sm text-muted">No matches yet.</p>
              )}
              <div className="flex flex-col gap-2">
                {myMatches.map((m) => {
                  const onA = m.teamA.includes(id);
                  const mine = onA ? m.scoreA : m.scoreB;
                  const theirs = onA ? m.scoreB : m.scoreA;
                  const partnerId = (onA ? m.teamA : m.teamB).find((i) => i !== id);
                  const oppIds = onA ? m.teamB : m.teamA;
                  const partner = all.find((x) => x.id === partnerId);
                  const opps = oppIds.map((oid) => all.find((x) => x.id === oid));
                  const won = (mine ?? 0) > (theirs ?? 0);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <div className="flex items-center gap-1 w-28">
                        <Avatar name={partner?.name ?? ""} photoURL={partner?.photoURL} size={22} />
                        <span className="truncate text-[11px]">{partner?.name.split(" ")[0]}</span>
                      </div>
                      <span className="text-muted text-xs">vs</span>
                      <div className="flex items-center gap-1 flex-1">
                        {opps.map((o, i) => (
                          <Avatar key={i} name={o?.name ?? ""} photoURL={o?.photoURL} size={22} />
                        ))}
                      </div>
                      <span
                        className={`font-mono font-bold text-sm ${won ? "text-turf-600" : "text-muted"}`}
                      >
                        {mine ?? "–"} · {theirs ?? "–"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {me?.id === id && (
              <Link href="/onboarding" className="btn btn-ghost">
                <Sparkles size={14} /> Edit profile
              </Link>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card px-2 py-3 flex flex-col items-center ${
        highlight ? "bg-gradient-to-br from-pink-300 to-pink-200" : ""
      }`}
    >
      <span className="font-display text-2xl tabular-nums text-ink">
        {value ?? 0}
      </span>
      <span className="text-[10px] tracking-widest uppercase text-muted mt-0.5">
        {label}
      </span>
    </div>
  );
}
