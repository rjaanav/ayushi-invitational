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
import type { Match, Player, Round } from "@/lib/types";
import { ArrowLeft, Check, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SchedulePage() {
  const { item: tournament } = useTournament();
  const { items: rounds } = useRounds();
  const { items: matches } = useMatches();
  const { items: players } = usePlayers();

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.number - b.number),
    [rounds]
  );

  // "Courts in play" for the header comes from the latest round's match
  // count — that reflects auto-scaling for small fields accurately.
  const latestRound = sortedRounds[sortedRounds.length - 1];
  const courtsInPlay = latestRound
    ? matches.filter((m) => m.roundId === latestRound.id).length
    : (tournament?.courts ?? 0);

  const currentRoundNumber = tournament?.currentRound ?? 0;
  const completedGames = matches.filter((m) => m.status === "completed").length;

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted"
          >
            <ArrowLeft size={14} /> Home
          </Link>
          <h1 className="font-display text-3xl mt-2">Full schedule</h1>
          <p className="text-sm text-muted">
            {tournament?.totalRounds ?? 0} rounds · {courtsInPlay}{" "}
            {courtsInPlay === 1 ? "court" : "courts"}
            {completedGames > 0 && ` · ${completedGames} games final`}
          </p>
        </div>

        {sortedRounds.length === 0 && (
          <div className="card p-6 text-center">
            <p className="font-display text-xl">Schedule drops at tip-off</p>
            <p className="text-sm text-muted mt-1">
              Pairings are generated round-by-round, Americano style.
            </p>
          </div>
        )}

        {sortedRounds.map((r) => (
          <RoundCard
            key={r.id}
            round={r}
            matches={matches.filter((m) => m.roundId === r.id)}
            playerMap={playerMap}
            isCurrent={r.number === currentRoundNumber}
          />
        ))}
      </main>
      <BottomNav />
    </div>
  );
}

function RoundCard({
  round,
  matches,
  playerMap,
  isCurrent,
}: {
  round: Round;
  matches: Match[];
  playerMap: Map<string, Player>;
  isCurrent: boolean;
}) {
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => a.court - b.court),
    [matches]
  );
  const completedCount = sortedMatches.filter(
    (m) => m.status === "completed"
  ).length;
  const allComplete =
    sortedMatches.length > 0 && completedCount === sortedMatches.length;
  const isLive = round.status === "live" || isCurrent;

  const resters = (round.resting ?? [])
    .map((id) => playerMap.get(id))
    .filter(Boolean) as Player[];

  const chip = allComplete ? (
    <span className="chip chip-turf">
      <Check size={12} /> Final
    </span>
  ) : isLive ? (
    <span className="chip chip-turf">
      <span className="w-1.5 h-1.5 rounded-full bg-turf-600 animate-pulse" />
      Live
    </span>
  ) : (
    <span className="chip capitalize">{round.status}</span>
  );

  return (
    <section
      className={cn(
        "rounded-3xl bg-white p-4 shadow-[0_6px_20px_-14px_rgba(17,24,39,0.3)] border",
        isCurrent && !allComplete
          ? "border-pink-300/70 ring-2 ring-pink-300/40"
          : "border-black/5"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-display text-xl">Round {round.number}</p>
          <p className="text-[11px] text-muted mt-0.5">
            {sortedMatches.length} match
            {sortedMatches.length === 1 ? "" : "es"}
            {sortedMatches.length > 0 &&
              ` · ${completedCount}/${sortedMatches.length} final`}
          </p>
        </div>
        {chip}
      </div>

      <div className="flex flex-col gap-2">
        {sortedMatches.map((m) => (
          <MatchRow key={m.id} match={m} playerMap={playerMap} />
        ))}
      </div>

      {resters.length > 0 && (
        <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-2">
          <Coffee size={14} className="text-court-700 shrink-0" />
          <p className="text-[11px] text-muted">
            Resting:{" "}
            <span className="text-ink/80 font-medium">
              {resters.map((p) => p.name.split(" ")[0]).join(", ")}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

function MatchRow({
  match,
  playerMap,
}: {
  match: Match;
  playerMap: Map<string, Player>;
}) {
  const teamA = match.teamA.map((id) => playerMap.get(id));
  const teamB = match.teamB.map((id) => playerMap.get(id));
  const completed = match.status === "completed";
  const a = match.scoreA ?? 0;
  const b = match.scoreB ?? 0;
  const winner: "A" | "B" | "tie" | null = completed
    ? a > b
      ? "A"
      : b > a
        ? "B"
        : "tie"
    : null;

  const statusBadge = completed ? (
    <span className="chip chip-turf !px-1.5 !py-0 text-[9px]">Final</span>
  ) : match.status === "live" ? (
    <span className="chip chip-turf !px-1.5 !py-0 text-[9px]">
      <span className="w-1 h-1 rounded-full bg-turf-600 animate-pulse" />
      Live
    </span>
  ) : (
    <span className="chip !px-1.5 !py-0 text-[9px]">Upcoming</span>
  );

  return (
    <div className="rounded-2xl bg-sand/60 border border-black/5 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">
          Court {match.court}
        </span>
        {statusBadge}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamSide
          team={teamA}
          result={winner === "A" ? "win" : winner === "B" ? "loss" : null}
        />
        <div className="flex flex-col items-center min-w-[72px]">
          {completed ? (
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "font-display text-2xl tabular-nums",
                  winner === "A" ? "text-turf-600 font-bold" : "text-muted"
                )}
              >
                {a}
              </span>
              <span className="text-xs text-muted">:</span>
              <span
                className={cn(
                  "font-display text-2xl tabular-nums",
                  winner === "B" ? "text-turf-600 font-bold" : "text-muted"
                )}
              >
                {b}
              </span>
            </div>
          ) : (
            <span className="font-display text-base text-muted">vs</span>
          )}
          {completed && winner === "tie" && (
            <span className="text-[9px] uppercase tracking-wider text-muted mt-0.5">
              Tie
            </span>
          )}
        </div>
        <TeamSide
          team={teamB}
          result={winner === "B" ? "win" : winner === "A" ? "loss" : null}
          rightAlign
        />
      </div>
    </div>
  );
}

function TeamSide({
  team,
  result,
  rightAlign,
}: {
  team: (Player | undefined)[];
  result: "win" | "loss" | null;
  rightAlign?: boolean;
}) {
  const isWin = result === "win";
  const isLoss = result === "loss";
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 min-w-0",
        rightAlign && "items-end text-right"
      )}
    >
      <div
        className={cn("flex -space-x-1.5", rightAlign && "flex-row-reverse space-x-reverse -space-x-1.5")}
      >
        {team.map((p, i) => (
          <Avatar
            key={p?.id ?? i}
            name={p?.name ?? ""}
            photoURL={p?.photoURL}
            size={28}
            className={cn(
              isWin && "ring-2 ring-turf-500 ring-offset-2 ring-offset-sand",
              isLoss && "opacity-70"
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          "text-[11px] truncate max-w-full",
          isWin ? "font-bold text-ink" : "font-semibold",
          isLoss && "text-muted"
        )}
      >
        {team
          .map((p) => p?.name.split(" ")[0] ?? "?")
          .join(" & ")}
      </p>
    </div>
  );
}
