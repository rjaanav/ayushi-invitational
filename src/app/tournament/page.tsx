"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
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
import { Check, Coffee, Loader2, Moon, Trophy } from "lucide-react";

export default function TournamentPage() {
  const { player } = useAuth();
  const { item: tournament } = useTournament();
  const { items: rounds } = useRounds();
  const { items: matches } = useMatches();
  const { items: players } = usePlayers();
  const [viewRound, setViewRound] = useState<number | null>(null);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const currentRoundNumber = tournament?.currentRound ?? 0;
  const activeRoundNumber = viewRound ?? currentRoundNumber;
  const activeRound = rounds.find((r) => r.number === activeRoundNumber) ?? null;
  const roundMatches = matches
    .filter((m) => m.roundId === activeRound?.id)
    .sort((a, b) => a.court - b.court);

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
              Tournament
            </p>
            <h1 className="font-display text-3xl">
              {tournament?.status === "live" ? "Live now" : "The Americano"}
            </h1>
          </div>
          {tournament?.status === "live" && (
            <span className="chip chip-turf">
              <span className="w-1.5 h-1.5 rounded-full bg-turf-600 animate-pulse" />
              Live · R{currentRoundNumber}
            </span>
          )}
        </header>

        {!tournament || tournament.status === "setup" ? (
          <div className="card p-6 text-center">
            <Moon className="mx-auto text-court-700 mb-2" />
            <p className="font-display text-xl">Not started yet</p>
            <p className="text-sm text-muted mt-1">
              Your admin will kick things off when everyone&rsquo;s on court.
            </p>
          </div>
        ) : (
          <>
            <RoundTabs
              rounds={rounds}
              total={tournament.totalRounds}
              activeNumber={activeRoundNumber}
              currentNumber={currentRoundNumber}
              onSelect={(n) => setViewRound(n)}
            />

            {activeRound && (
              <RoundDetail
                round={activeRound}
                matches={roundMatches}
                playerMap={playerMap}
                myId={player?.id}
                pointsPerMatch={tournament.pointsPerMatch}
                // Only admins can submit scores; everyone else gets a live,
                // read-only view of the same matches.
                canScore={Boolean(player?.isAdmin)}
              />
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function RoundTabs({
  rounds,
  total,
  activeNumber,
  currentNumber,
  onSelect,
}: {
  rounds: Round[];
  total: number;
  activeNumber: number;
  currentNumber: number;
  onSelect: (n: number) => void;
}) {
  const tabs: { n: number; label: string; status: Round["status"] | "pending" }[] = [];
  for (let i = 1; i <= total; i++) {
    const r = rounds.find((r) => r.number === i);
    tabs.push({
      n: i,
      label: `R${i}`,
      status: r ? r.status : "pending",
    });
  }
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-2 min-w-max">
        {tabs.map((t) => {
          const active = t.n === activeNumber;
          return (
            <button
              key={t.n}
              onClick={() => onSelect(t.n)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all",
                active
                  ? "bg-court-800 text-white shadow-md"
                  : "bg-white text-ink-soft border border-black/5",
                t.n === currentNumber && !active && "ring-2 ring-pink-300"
              )}
            >
              {t.label}
              {t.status === "live" && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-turf-500 animate-pulse" />
              )}
              {t.status === "completed" && (
                <span className="ml-1.5 text-turf-500">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoundDetail({
  round,
  matches,
  playerMap,
  myId,
  pointsPerMatch,
  canScore,
}: {
  round: Round;
  matches: Match[];
  playerMap: Map<string, Player>;
  myId?: string;
  pointsPerMatch: number;
  canScore: boolean;
}) {
  const resters = round.resting.map((id) => playerMap.get(id)).filter(Boolean) as Player[];

  return (
    <div className="flex flex-col gap-4">
      {matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          playerMap={playerMap}
          myId={myId}
          pointsPerMatch={pointsPerMatch}
          canScore={canScore}
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
                <Avatar name={p.name} photoURL={p.photoURL} size={38} ring />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            Hydrate, hype up the courts, grab the mic 🎤
          </p>
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  playerMap,
  myId,
  pointsPerMatch,
  canScore,
}: {
  match: Match;
  playerMap: Map<string, Player>;
  myId?: string;
  pointsPerMatch: number;
  canScore: boolean;
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
          canEdit={canScore}
          canIncrement={!atCap}
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
          canEdit={canScore}
          canIncrement={!atCap}
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
          {canScore && !completed && (
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
          {!canScore && !completed && (
            <p className="text-[11px] text-muted">
              Host scores it. Updates live.
            </p>
          )}
          {canScore && completed && total !== pointsPerMatch && (
            <p className="text-[11px] text-amber-600 font-semibold">
              Saved at {total}/{pointsPerMatch} — edit if that&rsquo;s wrong.
            </p>
          )}
        </div>
        {canScore && (
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
}: {
  team: (Player | undefined)[];
  score: number;
  canEdit: boolean;
  canIncrement: boolean;
  onChange: (n: number) => void;
  rightAlign?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", rightAlign && "items-end text-right")}>
      <div className={cn("flex -space-x-2", rightAlign && "justify-end")}>
        {team.map((p, i) => (
          <Avatar key={p?.id ?? i} name={p?.name ?? ""} photoURL={p?.photoURL} size={36} ring />
        ))}
      </div>
      <div className={cn(rightAlign && "text-right")}>
        {team.map((p, i) => (
          <p key={p?.id ?? i} className="text-[11px] font-semibold truncate max-w-[9rem]">
            {p?.name || "?"}
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
            <span className="font-display text-3xl tabular-nums w-10 text-center">
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
          <span className="font-display text-3xl tabular-nums">{score}</span>
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
