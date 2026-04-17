"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CountdownTimer } from "@/components/CountdownTimer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/hooks/useAuth";
import { EVENT } from "@/lib/eventConfig";
import { usePlayers, useTournament, useRounds, useMatches } from "@/lib/firebase/db";
import { Avatar } from "@/components/Avatar";
import { useMemo } from "react";
import { ArrowRight, Sparkles, Trophy } from "lucide-react";

export default function HomePage() {
  const { firebaseUser, player, loading, configured } = useAuth();
  const { item: tournament } = useTournament();
  const { items: players } = usePlayers();
  const { items: rounds } = useRounds();
  const { items: matches } = useMatches();

  const currentRound = useMemo(() => {
    if (!tournament) return null;
    return (
      rounds.find((r) => r.number === tournament.currentRound) ?? null
    );
  }, [rounds, tournament]);

  const myNextMatch = useMemo(() => {
    if (!player || !currentRound) return null;
    return (
      matches.find(
        (m) =>
          m.roundId === currentRound.id &&
          [...m.teamA, ...m.teamB].includes(player.id) &&
          m.status !== "completed"
      ) ?? null
    );
  }, [matches, currentRound, player]);

  const topPlayers = players.slice(0, 3);

  const needsLogin = !loading && configured && !firebaseUser;
  const needsOnboarding =
    !loading && configured && firebaseUser && (!player?.name || !player?.photoURL);

  return (
    <div className="flex-1 flex flex-col pb-24">
      <TopBar />

      <main className="flex-1 px-4 pt-4 pb-6 flex flex-col gap-5">
        {/* Hero card */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl"
        >
          <div className="absolute inset-0 court-pattern" />
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pink-400/40 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-turf-400/40 blur-2xl" />
          <div className="relative p-6 text-ink">
            <p className="text-[11px] tracking-[0.32em] uppercase opacity-70">
              Ayushi&rsquo;s Birthday · Midnight
            </p>
            <h1 className="font-display text-4xl leading-tight mt-2">
              A night of <span className="text-pink-500">padel</span>,
              <br /> chaos &amp; confetti.
            </h1>
            <p className="mt-3 text-sm opacity-70 max-w-xs">
              {EVENT.tagline}
            </p>
            <div className="mt-5">
              <CountdownTimer target={EVENT.start} label="TIP-OFF IN" />
            </div>
          </div>
        </motion.section>

        {/* Auth/onboarding CTAs */}
        {!configured && (
          <div className="card p-4 text-sm">
            <p className="font-semibold text-ink">Firebase not configured yet</p>
            <p className="text-muted mt-1">
              Drop your Firebase keys into <code>.env.local</code> (see README) and
              restart the dev server. The countdown still works meanwhile.
            </p>
          </div>
        )}

        {needsLogin && (
          <Link
            href="/login"
            className="card p-4 flex items-center justify-between bg-gradient-to-r from-pink-100 to-white"
          >
            <div>
              <p className="font-semibold text-ink">Join the Invitational</p>
              <p className="text-sm text-muted">
                Sign in with your phone to claim your spot.
              </p>
            </div>
            <ArrowRight className="text-court-700" />
          </Link>
        )}

        {needsOnboarding && (
          <Link
            href="/onboarding"
            className="card p-4 flex items-center justify-between bg-gradient-to-r from-turf-300/40 to-white"
          >
            <div>
              <p className="font-semibold text-ink">Finish your profile</p>
              <p className="text-sm text-muted">
                Add your name &amp; a selfie with Ayushi.
              </p>
            </div>
            <ArrowRight className="text-court-700" />
          </Link>
        )}

        {/* Your next match */}
        {player && myNextMatch && (
          <MatchCallout
            matchNumber={myNextMatch.court}
            roundNumber={myNextMatch.roundNumber}
            me={player.id}
            teamA={myNextMatch.teamA}
            teamB={myNextMatch.teamB}
            players={players}
          />
        )}

        {/* Tournament status */}
        {tournament?.status === "live" && currentRound && (
          <Link
            href="/tournament"
            className="card p-4 flex items-center justify-between"
          >
            <div>
              <p className="chip chip-turf">Round {currentRound.number} · LIVE</p>
              <p className="font-display text-lg text-ink mt-2">
                {matches.filter((m) => m.roundId === currentRound.id && m.status === "live").length} matches on court
              </p>
              <p className="text-xs text-muted mt-0.5">
                Tap to watch, score &amp; cheer.
              </p>
            </div>
            <Trophy className="text-court-700" />
          </Link>
        )}

        {/* Podium preview */}
        {players.length > 0 && (
          <Link href="/leaderboard" className="card p-4 block">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="chip">Live Board</p>
                <p className="font-display text-lg mt-1">Who&rsquo;s cooking</p>
              </div>
              <ArrowRight className="text-muted" />
            </div>
            <ol className="space-y-2">
              {topPlayers.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-pink-100/40"
                >
                  <span className="w-6 text-center font-display text-lg text-court-800">
                    {idx + 1}
                  </span>
                  <Avatar name={p.name} photoURL={p.photoURL} size={36} />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{p.name || "Player"}</p>
                    <p className="text-xs text-muted">
                      {p.matchesPlayed} matches · +{p.pointsFor - p.pointsAgainst} diff
                    </p>
                  </div>
                  <span className="font-mono font-bold text-court-800">
                    {p.points}
                  </span>
                </li>
              ))}
            </ol>
          </Link>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <QuickLink
            href="/leaderboard"
            icon={<Trophy size={18} />}
            title="Leaderboard"
            subtitle="Live rankings."
            tone="court"
          />
          <QuickLink
            href="/predictions"
            icon={<Sparkles size={18} />}
            title="Predictions"
            subtitle="Call it early."
            tone="pink"
          />
          <QuickLink
            href="/schedule"
            icon={<Trophy size={18} />}
            title="Schedule"
            subtitle="All rounds."
            tone="turf"
          />
          <QuickLink
            href="/awards"
            icon={<Sparkles size={18} />}
            title="Awards"
            subtitle="Hall of fame."
            tone="sand"
          />
          <QuickLink
            href="/players"
            icon={<Sparkles size={18} />}
            title="Players"
            subtitle={`${players.length}/${EVENT.maxPlayers} in`}
            tone="pink"
          />
          <QuickLink
            href="/bigscreen"
            icon={<Trophy size={18} />}
            title="Big Screen"
            subtitle="Project to TV."
            tone="court"
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function MatchCallout({
  matchNumber,
  roundNumber,
  me,
  teamA,
  teamB,
  players,
}: {
  matchNumber: number;
  roundNumber: number;
  me: string;
  teamA: string[];
  teamB: string[];
  players: { id: string; name: string; photoURL?: string }[];
}) {
  const find = (id: string) => players.find((p) => p.id === id);
  const onTeamA = teamA.includes(me);
  const myTeam = onTeamA ? teamA : teamB;
  const vs = onTeamA ? teamB : teamA;
  const partnerId = myTeam.find((id) => id !== me);
  const partner = partnerId ? find(partnerId) : null;
  const v1 = find(vs[0] ?? "");
  const v2 = find(vs[1] ?? "");
  return (
    <Link
      href="/tournament"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-400 to-pink-300 text-white p-5"
    >
      <p className="text-[11px] tracking-[0.25em] uppercase opacity-90">
        You&rsquo;re up · Round {roundNumber} · Court {matchNumber}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center -space-x-2">
          <Avatar name={partner?.name ?? ""} photoURL={partner?.photoURL} size={44} ring />
          <Avatar name="Me" size={44} ring />
        </div>
        <span className="font-display text-3xl">vs</span>
        <div className="flex items-center -space-x-2">
          <Avatar name={v1?.name ?? ""} photoURL={v1?.photoURL} size={44} ring />
          <Avatar name={v2?.name ?? ""} photoURL={v2?.photoURL} size={44} ring />
        </div>
      </div>
      <p className="mt-4 text-sm opacity-90">
        Partner: <strong>{partner?.name ?? "TBD"}</strong>
      </p>
    </Link>
  );
}

function QuickLink({
  href,
  icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "pink" | "turf" | "court" | "sand";
}) {
  const toneClass = {
    pink: "from-pink-200 to-white",
    turf: "from-turf-300/60 to-white",
    court: "from-court-500/20 to-white",
    sand: "from-sand to-white",
  }[tone];
  return (
    <Link
      href={href}
      className={`card p-4 bg-gradient-to-br ${toneClass} flex flex-col gap-2`}
    >
      <div className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center text-court-800">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-ink text-sm">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </Link>
  );
}
