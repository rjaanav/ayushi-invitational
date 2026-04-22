"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  useMatches,
  usePlayers,
  useRounds,
  useTournament,
} from "@/lib/firebase/db";
import type { Match, Player, Round } from "@/lib/types";
import { submitMatchScore, voteMVP } from "@/lib/firebase/tournamentActions";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  Clock,
  Coffee,
  Loader2,
  Moon,
  Trophy,
} from "lucide-react";

/**
 * Shared tournament surface: every generated round stacked vertically, each
 * with the match cards. Admins (default) get the full +/- score controls and
 * Submit button. Non-admins pass `readOnly` and see the exact same layout —
 * scores, winner highlights, rest list, MVP prompt — just without any edit
 * affordances.
 */
export function LiveScoring({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { player } = useAuth();
  const { item: tournament } = useTournament();
  const { items: rounds } = useRounds();
  const { items: matches } = useMatches();
  const { items: players } = usePlayers();

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const currentRoundNumber = tournament?.currentRound ?? 0;
  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.number - b.number),
    [rounds]
  );
  const matchesByRound = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const list = map.get(m.roundId) ?? [];
      list.push(m);
      map.set(m.roundId, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => a.court - b.court);
      map.set(k, list);
    }
    return map;
  }, [matches]);

  const notStarted = !tournament || tournament.status === "setup";
  const awaitingFirstRound = !notStarted && sortedRounds.length === 0;
  const placeholderCount =
    tournament && !notStarted
      ? Math.max(0, (tournament.totalRounds ?? 0) - sortedRounds.length)
      : 0;

  // The current round has "ended" when every match that belongs to it is
  // completed. Until the host generates the next round we want to reflect that
  // in the header chip — swap pulsing "Live" for a "Final" badge so the page
  // doesn't keep advertising live action that's already over.
  const currentRound = sortedRounds.find(
    (r) => r.number === currentRoundNumber
  );
  const currentRoundMatches = currentRound
    ? matchesByRound.get(currentRound.id) ?? []
    : [];
  const currentRoundEnded =
    currentRoundMatches.length > 0 &&
    currentRoundMatches.every((m) => m.status === "completed");

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            {readOnly ? "Tournament" : "Live scoring"}
          </p>
          <h2 className="font-display text-2xl">
            {tournament?.status === "live" ? "On court now" : "The Americano"}
          </h2>
          {tournament && !notStarted && (
            <p className="text-[11px] text-muted mt-1">
              {sortedRounds.length} of {tournament.totalRounds} rounds played
              {" "}· {matches.filter((m) => m.status === "completed").length}{" "}
              games final
            </p>
          )}
        </div>
        {tournament?.status === "live" && currentRoundNumber > 0 && (
          currentRoundEnded ? (
            <span className="chip chip-turf">
              <Check size={12} /> R{currentRoundNumber} · Final
            </span>
          ) : (
            <span className="chip chip-turf">
              <span className="w-1.5 h-1.5 rounded-full bg-turf-600 animate-pulse" />
              Live · R{currentRoundNumber}
            </span>
          )
        )}
      </header>

      {notStarted ? (
        <div className="card p-6 text-center">
          <Moon className="mx-auto text-court-700 mb-2" />
          <p className="font-display text-xl">Not started yet</p>
          <p className="text-sm text-muted mt-1">
            {readOnly
              ? "Your host will kick things off when everyone's on court."
              : "Initialize the tournament below, then generate round 1 to start scoring."}
          </p>
        </div>
      ) : awaitingFirstRound ? (
        <div className="card p-6 text-center">
          <Clock className="mx-auto text-court-700 mb-2" />
          <p className="font-display text-xl">Waiting on the first round</p>
          <p className="text-sm text-muted mt-1">
            {readOnly
              ? "Pairings appear here the moment the host generates them."
              : "Tap Generate round 1 below to produce the first pairings."}
          </p>
        </div>
      ) : (
        <>
          {sortedRounds.map((round) => (
            <RoundSection
              key={round.id}
              round={round}
              matches={matchesByRound.get(round.id) ?? []}
              playerMap={playerMap}
              myId={player?.id}
              pointsPerMatch={tournament!.pointsPerMatch}
              isCurrent={round.number === currentRoundNumber}
              readOnly={readOnly}
            />
          ))}
          {placeholderCount > 0 && (
            <UpcomingRoundsPlaceholder
              from={sortedRounds.length + 1}
              count={placeholderCount}
            />
          )}
        </>
      )}
    </section>
  );
}

/**
 * A single round with a header that's always visible (so scores stay readable
 * at a glance even when the round is collapsed) and an expandable body with
 * the full match cards. Current round stays expanded by default.
 */
function RoundSection({
  round,
  matches,
  playerMap,
  myId,
  pointsPerMatch,
  isCurrent,
  readOnly,
}: {
  round: Round;
  matches: Match[];
  playerMap: Map<string, Player>;
  myId?: string;
  pointsPerMatch: number;
  isCurrent: boolean;
  readOnly: boolean;
}) {
  const completedCount = matches.filter((m) => m.status === "completed").length;
  const allComplete = matches.length > 0 && completedCount === matches.length;

  // Past, fully-complete rounds collapse by default so the current round is
  // the easiest thing to find. Current/in-progress rounds stay expanded.
  const [open, setOpen] = useState(!allComplete || isCurrent);
  // If a round flips to "current" (e.g. admin just generated the next round),
  // pop it back open.
  useEffect(() => {
    if (isCurrent) setOpen(true);
  }, [isCurrent]);

  const resters = (round.resting ?? [])
    .map((id) => playerMap.get(id))
    .filter(Boolean) as Player[];

  const statusChip = (() => {
    if (allComplete) {
      return (
        <span className="chip chip-turf">
          <Check size={12} /> Final
        </span>
      );
    }
    if (round.status === "live" || isCurrent) {
      return (
        <span className="chip chip-turf">
          <span className="w-1.5 h-1.5 rounded-full bg-turf-600 animate-pulse" />
          Live
        </span>
      );
    }
    return <span className="chip">Upcoming</span>;
  })();

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl bg-white overflow-hidden shadow-[0_6px_20px_-14px_rgba(17,24,39,0.3)] border",
        isCurrent ? "border-pink-300/70 ring-2 ring-pink-300/40" : "border-black/5"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display text-xl">Round {round.number}</p>
            {statusChip}
          </div>
          <p className="text-[11px] text-muted mt-0.5">
            {matches.length} match{matches.length === 1 ? "" : "es"}
            {matches.length > 0 &&
              ` · ${completedCount}/${matches.length} complete`}
            {resters.length > 0 &&
              ` · ${resters.length} resting`}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "text-muted shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Always-visible compact score strip. Even when the round is collapsed,
          non-admins see who played, the final score, and who won.  */}
      {matches.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {matches.map((m) => (
            <CompactScoreRow
              key={m.id}
              match={m}
              playerMap={playerMap}
              myId={myId}
            />
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-1 border-t border-black/5 flex flex-col gap-3">
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  playerMap={playerMap}
                  myId={myId}
                  pointsPerMatch={pointsPerMatch}
                  readOnly={readOnly}
                />
              ))}

              {resters.length > 0 && (
                <div className="card p-4 bg-pink-100/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Coffee size={16} className="text-court-700" />
                    <p className="text-xs uppercase tracking-wider font-bold text-court-800">
                      Resting this round
                    </p>
                  </div>
                  <div className="flex -space-x-2">
                    {resters.map((p) => (
                      <div key={p.id} title={p.name}>
                        <Avatar
                          name={p.name}
                          photoURL={p.photoURL}
                          size={38}
                          ring
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-2">
                    Hydrate, hype up the courts, grab the mic 🎤
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function UpcomingRoundsPlaceholder({
  from,
  count,
}: {
  from: number;
  count: number;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-court-200/60 bg-white/40 p-4 flex items-center gap-3">
      <Clock size={16} className="text-court-700" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          {count === 1
            ? `Round ${from}`
            : `Rounds ${from}–${from + count - 1}`}
        </p>
        <p className="text-[11px] text-muted">
          Still to be generated by the host.
        </p>
      </div>
    </div>
  );
}

/**
 * A single-line readout of a match. Always visible (even when the round is
 * collapsed) so non-admins can scan the whole tournament in one scroll. Shows
 * avatars, team names, and the score once submitted.
 */
function CompactScoreRow({
  match,
  playerMap,
  myId,
}: {
  match: Match;
  playerMap: Map<string, Player>;
  myId?: string;
}) {
  const teamA = match.teamA.map((id) => playerMap.get(id));
  const teamB = match.teamB.map((id) => playerMap.get(id));
  const completed = match.status === "completed";
  const hasScore = typeof match.scoreA === "number" && typeof match.scoreB === "number";
  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;
  const winner = completed && hasScore
    ? scoreA > scoreB
      ? "A"
      : scoreB > scoreA
        ? "B"
        : "tie"
    : null;
  const imOnA = myId ? match.teamA.includes(myId) : false;
  const imOnB = myId ? match.teamB.includes(myId) : false;
  const mine = imOnA || imOnB;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs rounded-xl px-2 py-1.5 bg-sand/30",
        mine && "bg-pink-100/60"
      )}
    >
      <span className="text-[10px] uppercase tracking-widest text-muted w-10 shrink-0">
        C{match.court}
      </span>
      <TeamStrip
        team={teamA}
        winner={winner === "A"}
        loser={winner === "B"}
      />
      <ScorePill
        completed={completed}
        hasScore={hasScore}
        live={match.status === "live"}
        a={scoreA}
        b={scoreB}
        winner={winner}
      />
      <TeamStrip
        team={teamB}
        winner={winner === "B"}
        loser={winner === "A"}
        rightAlign
      />
    </div>
  );
}

function TeamStrip({
  team,
  winner,
  loser,
  rightAlign,
}: {
  team: (Player | undefined)[];
  winner?: boolean;
  loser?: boolean;
  rightAlign?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 flex-1 min-w-0",
        rightAlign && "justify-end"
      )}
    >
      {!rightAlign && (
        <div className="flex -space-x-1.5 shrink-0">
          {team.map((p, i) => (
            <Avatar
              key={p?.id ?? i}
              name={p?.name ?? ""}
              photoURL={p?.photoURL}
              size={20}
            />
          ))}
        </div>
      )}
      <p
        className={cn(
          "text-[11px] truncate",
          winner && "font-bold text-ink",
          loser && "text-muted",
          !winner && !loser && "font-semibold"
        )}
      >
        {team
          .map((p) => p?.name.split(" ")[0] ?? "?")
          .join(" & ")}
      </p>
      {rightAlign && (
        <div className="flex -space-x-1.5 shrink-0">
          {team.map((p, i) => (
            <Avatar
              key={p?.id ?? i}
              name={p?.name ?? ""}
              photoURL={p?.photoURL}
              size={20}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScorePill({
  completed,
  hasScore,
  live,
  a,
  b,
  winner,
}: {
  completed: boolean;
  hasScore: boolean;
  live: boolean;
  a: number;
  b: number;
  winner: "A" | "B" | "tie" | null;
}) {
  if (!hasScore || (!completed && a === 0 && b === 0)) {
    return (
      <span
        className={cn(
          "font-mono text-[11px] px-2 py-0.5 rounded-full shrink-0",
          live
            ? "bg-turf-500/15 text-turf-600 font-semibold"
            : "bg-black/5 text-muted"
        )}
      >
        {live ? "live" : "vs"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "font-mono font-bold tabular-nums text-sm px-2 py-0.5 rounded-full shrink-0",
        completed
          ? "bg-court-800 text-white"
          : "bg-turf-500/15 text-turf-700"
      )}
    >
      <span className={cn(winner === "A" && "text-pink-200")}>{a}</span>
      <span className="opacity-50 mx-0.5">–</span>
      <span className={cn(winner === "B" && "text-pink-200")}>{b}</span>
    </span>
  );
}

function MatchCard({
  match,
  playerMap,
  myId,
  pointsPerMatch,
  readOnly,
}: {
  match: Match;
  playerMap: Map<string, Player>;
  myId?: string;
  pointsPerMatch: number;
  readOnly: boolean;
}) {
  const [a, setA] = useState(match.scoreA ?? 0);
  const [b, setB] = useState(match.scoreB ?? 0);
  const [busy, setBusy] = useState(false);
  // Treat the remote scores as the source of truth — sync them into local
  // state whenever Firestore pushes a new snapshot. We protect against
  // clobbering an in-progress edit with a short "dirty" window: if the
  // scorekeeper on this device has tapped +/- in the last 8s, we skip the
  // sync so their taps don't fight incoming updates.
  const lastEditRef = useRef<number>(0);
  const markEdited = () => {
    lastEditRef.current = Date.now();
  };
  useEffect(() => {
    const sinceEdit = Date.now() - lastEditRef.current;
    if (sinceEdit < 8000) return;
    setA(match.scoreA ?? 0);
    setB(match.scoreB ?? 0);
  }, [match.id, match.scoreA, match.scoreB, match.status]);

  const teamA = match.teamA.map((id) => playerMap.get(id));
  const teamB = match.teamB.map((id) => playerMap.get(id));
  const imOnA = myId ? match.teamA.includes(myId) : false;
  const imOnB = myId ? match.teamB.includes(myId) : false;
  const mine = imOnA || imOnB;
  const completed = match.status === "completed";

  // Cumulative-cap bookkeeping. A match ends when a + b == pointsPerMatch,
  // so "remaining" drives whether the +/- buttons should still fire.
  const total = a + b;
  const remaining = Math.max(0, pointsPerMatch - total);
  const atCap = remaining <= 0;
  const winner: "A" | "B" | "tie" | null = completed
    ? a > b
      ? "A"
      : b > a
        ? "B"
        : "tie"
    : null;

  async function save() {
    if (total === 0) {
      toast.error("Enter a score first.");
      return;
    }
    if (a < 0 || b < 0) {
      toast.error("Scores can't be negative.");
      return;
    }
    if (total > pointsPerMatch) {
      toast.error(`Combined score can't exceed ${pointsPerMatch}.`);
      return;
    }
    if (total < pointsPerMatch) {
      const ok = confirm(
        `Match ends at ${pointsPerMatch} total points. You entered ${total}. Submit anyway?`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await submitMatchScore({
        matchId: match.id,
        scoreA: a,
        scoreB: b,
        maxTotal: pointsPerMatch,
      });
      toast.success("Score locked in 💥");
      if (imOnA ? a > b : b > a) {
        confetti({
          particleCount: 80,
          spread: 70,
          colors: ["#ff7fa3", "#3da668", "#0b3d4e", "#ffb6c6"],
          origin: { y: 0.3 },
        });
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "card p-4 relative overflow-hidden",
        mine && "ring-2 ring-pink-300",
        completed && "opacity-90"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="chip chip-court">Court {match.court}</span>
        {completed ? (
          <span className="chip chip-turf">
            <Check size={12} /> Final
          </span>
        ) : match.status === "live" ? (
          <span className="chip chip-turf">
            <span className="w-1.5 h-1.5 rounded-full bg-turf-600 animate-pulse" />
            Live
          </span>
        ) : (
          <span className="chip">Upcoming</span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamBlock
          team={teamA}
          score={a}
          canEdit={!readOnly}
          canIncrement={!atCap}
          result={winner === "A" ? "win" : winner === "B" ? "loss" : null}
          onChange={(n) => {
            markEdited();
            setA(Math.max(0, Math.min(n, pointsPerMatch - b)));
          }}
        />
        <div className="flex flex-col items-center">
          <span className="font-display text-xl text-muted">vs</span>
        </div>
        <TeamBlock
          team={teamB}
          score={b}
          canEdit={!readOnly}
          canIncrement={!atCap}
          result={winner === "B" ? "win" : winner === "A" ? "loss" : null}
          onChange={(n) => {
            markEdited();
            setB(Math.max(0, Math.min(n, pointsPerMatch - a)));
          }}
          rightAlign
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <p className="text-[11px] text-muted">
            Match to <strong className="text-ink">{pointsPerMatch}</strong> total
          </p>
          {!readOnly && !completed && (
            <p
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                atCap ? "text-turf-600" : "text-muted"
              )}
            >
              {atCap
                ? "Cap reached — ready to submit"
                : `${remaining} pt${remaining === 1 ? "" : "s"} remaining`}
            </p>
          )}
          {readOnly && !completed && (
            <p className="text-[11px] text-muted">
              Host scores it. Updates live.
            </p>
          )}
          {!readOnly && completed && total !== pointsPerMatch && (
            <p className="text-[11px] text-amber-600 font-semibold">
              Saved at {total}/{pointsPerMatch} — edit if that&rsquo;s wrong.
            </p>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={save}
            disabled={busy}
            className={cn("btn", completed ? "btn-ghost" : "btn-turf")}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : completed ? (
              "Update score"
            ) : (
              <>
                <Trophy size={14} />
                Submit
              </>
            )}
          </button>
        )}
      </div>

      {completed && myId && !match.mvpVotes?.[myId] && mine && (
        <MVPPrompt
          matchId={match.id}
          myId={myId}
          teammates={[...match.teamA, ...match.teamB]}
          playerMap={playerMap}
        />
      )}
    </motion.div>
  );
}

function TeamBlock({
  team,
  score,
  canEdit,
  canIncrement,
  onChange,
  rightAlign,
  result,
}: {
  team: (Player | undefined)[];
  score: number;
  canEdit: boolean;
  canIncrement: boolean;
  onChange: (n: number) => void;
  rightAlign?: boolean;
  result?: "win" | "loss" | null;
}) {
  const isWin = result === "win";
  const isLoss = result === "loss";
  return (
    <div className={cn("flex flex-col gap-2", rightAlign && "items-end text-right")}>
      <div className={cn("flex -space-x-2", rightAlign && "justify-end")}>
        {team.map((p, i) => (
          <Avatar
            key={p?.id ?? i}
            name={p?.name ?? ""}
            photoURL={p?.photoURL}
            size={36}
            ring={isWin || undefined}
            className={cn(
              isWin && "ring-2 ring-turf-500 ring-offset-2 ring-offset-white",
              isLoss && "opacity-70"
            )}
          />
        ))}
      </div>
      <div className={cn(rightAlign && "text-right")}>
        {team.map((p, i) => (
          <p
            key={p?.id ?? i}
            className={cn(
              "text-[11px] truncate max-w-[9rem]",
              isWin ? "font-bold text-ink" : "font-semibold",
              isLoss && "text-muted"
            )}
          >
            {p?.name || "?"}
            {isWin && i === 0 && (
              <span
                className="ml-1 inline-flex items-center justify-center rounded-full bg-turf-500/15 text-turf-700 text-[9px] font-bold px-1.5 py-[1px] align-middle"
                title="Winner"
              >
                W
              </span>
            )}
          </p>
        ))}
      </div>
      <div className={cn("flex items-center gap-2 mt-1", rightAlign && "justify-end")}>
        {canEdit ? (
          <>
            <button
              onClick={() => onChange(Math.max(0, score - 1))}
              disabled={score <= 0}
              className={cn(
                "w-7 h-7 rounded-full font-bold transition-opacity",
                score <= 0 ? "bg-black/5 text-muted opacity-50" : "bg-black/5"
              )}
              aria-label="Decrement"
            >
              −
            </button>
            <span
              className={cn(
                "font-display text-3xl tabular-nums w-10 text-center",
                isWin && "text-turf-600",
                isLoss && "text-muted"
              )}
            >
              {score}
            </span>
            <button
              onClick={() => onChange(score + 1)}
              disabled={!canIncrement}
              className={cn(
                "w-7 h-7 rounded-full font-bold transition-opacity",
                canIncrement
                  ? "bg-pink-200 text-pink-900"
                  : "bg-black/5 text-muted opacity-50"
              )}
              aria-label="Increment"
            >
              +
            </button>
          </>
        ) : (
          <span
            className={cn(
              "font-display text-3xl tabular-nums",
              isWin && "text-turf-600",
              isLoss && "text-muted"
            )}
          >
            {score}
          </span>
        )}
      </div>
    </div>
  );
}

function MVPPrompt({
  matchId,
  myId,
  teammates,
  playerMap,
}: {
  matchId: string;
  myId: string;
  teammates: string[];
  playerMap: Map<string, Player>;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 border-t border-black/5 pt-3"
        >
          <p className="text-xs font-semibold text-court-800 mb-2">
            🏅 MVP of this match?
          </p>
          <div className="flex gap-2 flex-wrap">
            {teammates.map((pid) => {
              const p = playerMap.get(pid);
              if (!p) return null;
              return (
                <button
                  key={pid}
                  onClick={() => setPick(pid)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border",
                    pick === pid
                      ? "bg-pink-400 text-white border-pink-400"
                      : "bg-white border-black/10"
                  )}
                >
                  <Avatar name={p.name} photoURL={p.photoURL} size={20} />
                  {p.name.split(" ")[0]}
                </button>
              );
            })}
          </div>
          <button
            onClick={async () => {
              if (!pick) return;
              try {
                await voteMVP({ matchId, voterId: myId, playerId: pick });
                setDone(true);
                toast.success("Vote cast 🏅");
              } catch {
                toast.error("Couldn't vote.");
              }
            }}
            disabled={!pick}
            className="btn btn-pink mt-3 w-full"
          >
            Lock vote
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
