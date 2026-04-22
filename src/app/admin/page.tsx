"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  doc,
  getDocs,
  collection,
  writeBatch,
} from "firebase/firestore";
import confetti from "canvas-confetti";
import {
  ChevronRight,
  Loader2,
  Play,
  PlusCircle,
  RotateCcw,
  Shield,
  Sparkles,
  TestTube,
  Trash2,
  Trophy,
  UserCog,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import { LiveScoring } from "@/components/LiveScoring";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  useMatches,
  usePlayers,
  useRounds,
  useTournament,
} from "@/lib/firebase/db";
import {
  generateNextRound,
  initTournament,
  promoteAdmin,
  removeTestPlayers,
  seedTestPlayers,
  startRound,
  updateTournament,
} from "@/lib/firebase/tournamentActions";
import { getDb } from "@/lib/firebase/client";
import { EVENT } from "@/lib/eventConfig";
import {
  MIN_PLAYERS_FOR_ROUND,
  effectiveCourtsFor,
} from "@/lib/americano";

export default function AdminPage() {
  const { player, loading } = useAuth();
  const { item: tournament } = useTournament();
  const { items: players } = usePlayers();
  const { items: rounds } = useRounds();
  const { items: matches } = useMatches();
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return null;
  if (!player) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="px-4 pt-6">
          <p className="text-sm text-muted">Please sign in.</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!player.isAdmin) {
    return (
      <div className="flex-1 flex flex-col pb-28">
        <TopBar />
        <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
          <header>
            <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
              Admin
            </p>
            <h1 className="font-display text-3xl">Locked ✋</h1>
            <p className="text-sm text-muted mt-1">
              You aren&rsquo;t an admin yet. Ask the host (Jaanav) to grant
              access from their admin panel, or set yourself as admin via
              Firestore: <code>players/&lt;your id&gt;.isAdmin = true</code>.
            </p>
          </header>
          <div className="card p-4">
            <p className="font-semibold text-sm">Your user ID</p>
            <p className="font-mono text-xs break-all text-muted mt-1">
              {player.id}
            </p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const currentRound = rounds.find((r) => r.number === tournament?.currentRound);
  const currentRoundMatches = matches.filter(
    (m) => m.roundId === currentRound?.id
  );
  const currentRoundCompleted =
    currentRoundMatches.length > 0 &&
    currentRoundMatches.every((m) => m.status === "completed");

  async function wrap(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something broke.");
    } finally {
      setBusy(null);
    }
  }

  const onboardedCount = players.filter((p) => p.name && p.photoURL).length;
  const configuredCourts = tournament?.courts ?? 0;
  const effectiveCourts = effectiveCourtsFor(onboardedCount, configuredCourts);
  const restersNextRound =
    effectiveCourts > 0 ? Math.max(0, onboardedCount - effectiveCourts * 4) : 0;
  const courtsScaled =
    effectiveCourts > 0 && effectiveCourts < configuredCourts;
  const canGenerate =
    onboardedCount >= MIN_PLAYERS_FOR_ROUND && effectiveCourts > 0;

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        <header>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            Admin
          </p>
          <h1 className="font-display text-3xl">Tournament cockpit 🎛️</h1>
        </header>

        {/* Live scoring — the primary thing the admin does during the event.
            Everything below is setup / cleanup. */}
        <LiveScoring />

        {/* Setup / State */}
        <section className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Tournament</p>
            <span className={`chip ${tournament?.status === "live" ? "chip-turf" : ""}`}>
              {tournament?.status ?? "not created"}
            </span>
          </div>
          {!tournament && (
            <button
              disabled={busy === "init"}
              onClick={() =>
                wrap("init", async () => {
                  await initTournament({
                    courts: EVENT.defaultCourts,
                    pointsPerMatch: EVENT.defaultPointsPerMatch,
                    totalRounds: 7,
                    startsAt: EVENT.start,
                  });
                  toast.success("Tournament initialized 🎾");
                })
              }
              className="btn btn-primary"
            >
              {busy === "init" ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={14} />}
              Initialize tournament
            </button>
          )}

          {tournament && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Onboarded" value={onboardedCount} />
                <Stat
                  label="Courts"
                  value={effectiveCourts || tournament.courts}
                  of={courtsScaled ? tournament.courts : undefined}
                />
                <Stat label="Target" value={tournament.pointsPerMatch} suffix="pts" />
              </div>
              {courtsScaled && (
                <p className="text-[11px] text-muted -mt-1">
                  Only {onboardedCount} players onboarded — scheduler will use
                  {" "}{effectiveCourts} court{effectiveCourts === 1 ? "" : "s"} per
                  round until more sign in.
                </p>
              )}
              {onboardedCount > 0 && onboardedCount < MIN_PLAYERS_FOR_ROUND && (
                <p className="text-[11px] text-pink-700 -mt-1">
                  Need at least {MIN_PLAYERS_FOR_ROUND} onboarded players to start a round.
                </p>
              )}
              {effectiveCourts > 0 && restersNextRound > 0 && (
                <p className="text-[11px] text-muted -mt-1">
                  Next round: {effectiveCourts * 4} play,{" "}
                  {restersNextRound} rest.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <SettingInput
                  label="Rounds"
                  value={tournament.totalRounds}
                  onSave={(v) => updateTournament({ totalRounds: Math.max(1, v) })}
                />
                <SettingInput
                  label="Courts"
                  value={tournament.courts}
                  onSave={(v) =>
                    updateTournament({ courts: Math.max(1, Math.min(10, v)) })
                  }
                />
                <SettingInput
                  label="Pts/match"
                  value={tournament.pointsPerMatch}
                  onSave={(v) => updateTournament({ pointsPerMatch: Math.max(8, v) })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  disabled={busy === "next" || !canGenerate}
                  onClick={() =>
                    wrap("next", async () => {
                      const { number } = await generateNextRound();
                      toast.success(`Round ${number} generated 🎾`);
                    })
                  }
                  className="btn btn-primary"
                >
                  {busy === "next" ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
                  {currentRound
                    ? currentRoundCompleted
                      ? "Generate next round"
                      : "Generate next round (current incomplete)"
                    : "Generate round 1"}
                </button>
                {currentRound?.status === "upcoming" && (
                  <button
                    disabled={busy === "start"}
                    onClick={() =>
                      wrap("start", async () => {
                        await startRound(currentRound.id);
                        toast.success("Round is LIVE 🔥");
                        confetti({
                          particleCount: 120,
                          spread: 90,
                          colors: ["#ff7fa3", "#3da668", "#0b3d4e"],
                        });
                      })
                    }
                    className="btn btn-turf"
                  >
                    {busy === "start" ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                    Start round {currentRound.number}
                  </button>
                )}
                {tournament.status === "live" && (
                  <button
                    disabled={busy === "complete"}
                    onClick={() =>
                      wrap("complete", async () => {
                        await updateTournament({ status: "completed" });
                        toast.success("Tournament wrapped 🏆");
                        confetti({
                          particleCount: 240,
                          spread: 100,
                          startVelocity: 45,
                          colors: ["#ff7fa3", "#ffb6c6", "#3da668", "#ffffff"],
                        });
                      })
                    }
                    className="btn btn-pink"
                  >
                    <Trophy size={16} /> Finish tournament
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* Players */}
        <section className="card p-4 flex flex-col gap-3">
          <p className="font-semibold text-sm flex items-center gap-2">
            <UserCog size={16} /> Players ({players.length})
          </p>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Avatar name={p.name} photoURL={p.photoURL} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {p.name || "(no name)"}
                    {p.isAdmin && (
                      <span className="chip chip-court ml-2 !py-0 !px-1.5 !text-[10px]">
                        <Shield size={10} /> admin
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted truncate">
                    {p.phone || p.id}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!p.isAdmin && (
                    <button
                      onClick={() =>
                        wrap(`admin-${p.id}`, async () => {
                          await promoteAdmin(p.id);
                          toast.success(`${p.name || "Player"} is now admin`);
                        })
                      }
                      className="text-xs px-2 py-1 rounded-full bg-court-800 text-white"
                    >
                      Make admin
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Test tools */}
        <section className="card p-4 bg-sand/40">
          <p className="font-semibold text-sm text-court-800 flex items-center gap-2">
            <TestTube size={14} /> Test tools
          </p>
          <p className="text-xs text-court-700/80 mt-1">
            Drop a full 14-player squad into the database to run the tournament
            end-to-end without real phone logins. Re-run to reset their stats.
          </p>
          <div className="flex flex-col gap-2 mt-3">
            <button
              disabled={busy === "seed"}
              onClick={() =>
                wrap("seed", async () => {
                  const { count } = await seedTestPlayers();
                  toast.success(`Seeded ${count} test players 🧪`);
                })
              }
              className="btn btn-primary"
            >
              {busy === "seed" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <TestTube size={14} />
              )}
              Seed 14 test players
            </button>
            <button
              disabled={busy === "unseed"}
              onClick={() =>
                wrap("unseed", async () => {
                  if (
                    !confirm(
                      "Remove all seeded test players and any rounds/matches they played in?"
                    )
                  )
                    return;
                  const res = await removeTestPlayers();
                  toast.success(
                    `Removed ${res.removed} test players` +
                      (res.matchesRemoved
                        ? ` + ${res.matchesRemoved} match${res.matchesRemoved === 1 ? "" : "es"}`
                        : "")
                  );
                })
              }
              className="btn btn-ghost"
            >
              {busy === "unseed" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Trash2 size={14} />
              )}
              Remove test players
            </button>
          </div>
        </section>

        {/* Danger */}
        <section className="card p-4 bg-red-50/60">
          <p className="font-semibold text-sm text-red-700 flex items-center gap-2">
            <RotateCcw size={14} /> Danger zone
          </p>
          <p className="text-xs text-red-700/80 mt-1">
            Use these carefully. They rewrite tournament state.
          </p>
          <div className="flex flex-col gap-2 mt-3">
            <button
              disabled={busy === "reset"}
              onClick={() =>
                wrap("reset", async () => {
                  if (!confirm("Wipe ALL rounds, matches and player stats?")) return;
                  const db = getDb();
                  const batch = writeBatch(db);
                  const [mSnap, rSnap, pSnap] = await Promise.all([
                    getDocs(collection(db, "matches")),
                    getDocs(collection(db, "rounds")),
                    getDocs(collection(db, "players")),
                  ]);
                  mSnap.docs.forEach((d) => batch.delete(d.ref));
                  rSnap.docs.forEach((d) => batch.delete(d.ref));
                  pSnap.docs.forEach((d) =>
                    batch.update(d.ref, {
                      points: 0,
                      wins: 0,
                      losses: 0,
                      matchesPlayed: 0,
                      pointsFor: 0,
                      pointsAgainst: 0,
                    })
                  );
                  batch.update(doc(db, "tournament", "main"), {
                    currentRound: 0,
                    status: "setup",
                  });
                  await batch.commit();
                  toast.success("Reset complete 🔄");
                })
              }
              className="btn btn-ghost !text-red-700"
            >
              Reset tournament data
            </button>
          </div>
        </section>

        <Link href="/leaderboard" className="card p-3 flex items-center justify-between">
          <span className="font-semibold text-sm">Open leaderboard</span>
          <ChevronRight />
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}

function Stat({
  label,
  value,
  of,
  suffix,
}: {
  label: string;
  value: number;
  of?: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl bg-sand/50 p-2 text-center">
      <p className="font-display text-xl tabular-nums">
        {value}
        {of !== undefined && <span className="text-sm text-muted">/{of}</span>}
        {suffix && <span className="text-xs text-muted ml-1">{suffix}</span>}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
    </div>
  );
}

function SettingInput({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (v: number) => Promise<void> | void;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="rounded-xl bg-white border border-black/5 p-2 flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </span>
      <input
        type="number"
        value={v}
        onChange={(e) => setV(parseInt(e.target.value || "0"))}
        onBlur={() => v !== value && onSave(v)}
        className="bg-transparent font-display text-lg outline-none tabular-nums"
      />
    </div>
  );
}

