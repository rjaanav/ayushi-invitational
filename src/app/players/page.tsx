"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import { usePlayers } from "@/lib/firebase/db";
import type { Player } from "@/lib/types";

export default function PlayersPage() {
  const { items: players } = usePlayers();
  const onboarded = players.filter((p) => p.name);
  const roster = onboarded.filter((p) => !p.isSpectator);
  const cheerSquad = onboarded.filter((p) => p.isSpectator);
  const count = onboarded.length;

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <header>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            The Line-up
          </p>
          <h1 className="font-display text-3xl">
            {count === 0
              ? "No one here yet."
              : count === 1
                ? "1 player. One night."
                : `${count} players. One night.`}
          </h1>
          <p className="text-sm text-muted mt-1">
            {count === 0
              ? "Be the first to check in."
              : `${roster.length} on the roster${
                  cheerSquad.length > 0
                    ? ` · ${cheerSquad.length} cheering`
                    : ""
                }.`}
          </p>
        </header>

        {roster.length > 0 && (
          <PlayerGrid title="On the roster" players={roster} />
        )}

        {cheerSquad.length > 0 && (
          <PlayerGrid
            title="Cheer squad"
            subtitle="Here for the vibes — not on a court tonight."
            players={cheerSquad}
            spectator
          />
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function PlayerGrid({
  title,
  subtitle,
  players,
  spectator,
}: {
  title: string;
  subtitle?: string;
  players: Player[];
  spectator?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
          {title}
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/players/${p.id}`}
            className="card p-3 flex flex-col items-center gap-2 hover:shadow-lg transition-shadow"
          >
            <Avatar name={p.name} photoURL={p.photoURL} size={68} ring />
            <div className="text-center min-w-0 w-full">
              <p className="font-semibold text-sm truncate">{p.name}</p>
              {p.funFact && (
                <p className="text-[11px] text-muted italic line-clamp-2 mt-0.5">
                  &ldquo;{p.funFact}&rdquo;
                </p>
              )}
            </div>
            {spectator ? (
              <span className="chip !py-0 !px-1.5 !text-[10px] bg-pink-100 text-pink-800 border border-pink-200">
                <Eye size={10} /> spectator
              </span>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span>{p.points} pts</span>
                <span>·</span>
                <span>
                  {p.wins}W-{p.losses}L
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
