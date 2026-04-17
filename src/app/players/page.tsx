"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import { usePlayers } from "@/lib/firebase/db";
import { EVENT } from "@/lib/eventConfig";

export default function PlayersPage() {
  const { items: players } = usePlayers();
  const onboarded = players.filter((p) => p.name);

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <header>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            The Line-up
          </p>
          <h1 className="font-display text-3xl">14 players. One night.</h1>
          <p className="text-sm text-muted mt-1">
            {onboarded.length} of {EVENT.maxPlayers} checked in.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {onboarded.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="card p-3 flex flex-col items-center gap-2 hover:shadow-lg transition-shadow"
            >
              <Avatar name={p.name} photoURL={p.photoURL} size={68} ring />
              <div className="text-center min-w-0 w-full">
                <p className="font-semibold text-sm truncate">
                  {p.name}
                  {p.isAyushi && " 👑"}
                </p>
                {p.funFact && (
                  <p className="text-[11px] text-muted italic line-clamp-2 mt-0.5">
                    &ldquo;{p.funFact}&rdquo;
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span>{p.points} pts</span>
                <span>·</span>
                <span>{p.wins}W-{p.losses}L</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
