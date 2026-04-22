"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Sparkles, Crown, Trophy, Target } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  usePlayers,
  usePredictions,
  useTournament,
} from "@/lib/firebase/db";
import { getDb } from "@/lib/firebase/client";

export default function PredictionsPage() {
  const { player } = useAuth();
  const { items: players } = usePlayers();
  const { items: predictions } = usePredictions();
  const { item: tournament } = useTournament();
  const myPred = predictions.find((p) => p.userId === player?.id);

  const [championId, setChampionId] = useState("");
  const [mvpId, setMvpId] = useState("");
  const [ayushiPlacement, setAyushiPlacement] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!myPred) return;
    setChampionId(myPred.championId ?? "");
    setMvpId(myPred.mvpId ?? "");
    setAyushiPlacement(myPred.ayushiPlacement ?? 1);
  }, [myPred]);

  const locked =
    tournament?.status === "live" || tournament?.status === "completed";

  async function save() {
    if (!player) return;
    setBusy(true);
    try {
      const db = getDb();
      const base: Record<string, unknown> = {
        userId: player.id,
        userName: player.name,
        championId: championId || null,
        mvpId: mvpId || null,
        ayushiPlacement,
        updatedAt: serverTimestamp(),
      };
      // Only stamp `createdAt` the first time so edits don't overwrite it.
      if (!myPred) base.createdAt = serverTimestamp();
      await setDoc(doc(db, "predictions", player.id), base, { merge: true });
      toast.success("Predictions locked 🔮");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  const onboarded = players.filter((p) => p.name);

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        <header>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            The Oracle
          </p>
          <h1 className="font-display text-3xl">
            Call it <span className="text-pink-500">before tip-off</span> 🔮
          </h1>
          <p className="text-sm text-muted mt-1 max-w-sm">
            Lock in your predictions. Points for correct calls — bragging rights
            for everything else.
          </p>
        </header>

        {locked && (
          <div className="card p-3 bg-pink-100/60 text-xs">
            🔒 Predictions locked — tournament is live.
          </div>
        )}

        {/* Champion */}
        <Section
          icon={<Crown className="text-pink-500" size={18} />}
          title="Who wins it all?"
          subtitle="Your champion of the night."
        >
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-2">
            {onboarded.map((p) => (
              <button
                key={p.id}
                disabled={locked}
                onClick={() => setChampionId(p.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-2xl min-w-[80px] border ${
                  championId === p.id
                    ? "bg-pink-300 border-pink-400"
                    : "bg-white border-black/5"
                }`}
              >
                <Avatar name={p.name} photoURL={p.photoURL} size={46} />
                <span className="text-[11px] font-semibold text-center line-clamp-1">
                  {p.name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* MVP */}
        <Section
          icon={<Trophy className="text-turf-600" size={18} />}
          title="Match MVP?"
          subtitle="Most dominant individual performer."
        >
          <select
            value={mvpId}
            disabled={locked}
            onChange={(e) => setMvpId(e.target.value)}
            className="input"
          >
            <option value="">Pick someone…</option>
            {onboarded.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Section>

        {/* Ayushi placement */}
        <Section
          icon={<Target className="text-court-700" size={18} />}
          title="Where does Ayushi finish?"
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={onboarded.length || 14}
              value={ayushiPlacement}
              disabled={locked}
              onChange={(e) => setAyushiPlacement(parseInt(e.target.value))}
              className="flex-1 accent-pink-500"
            />
            <div className="w-16 text-center">
              <p className="font-display text-2xl text-court-800">
                #{ayushiPlacement}
              </p>
              <p className="text-[10px] uppercase text-muted">place</p>
            </div>
          </div>
        </Section>

        {!locked && (
          <button disabled={busy || !player} onClick={save} className="btn btn-pink">
            <Sparkles size={14} /> Lock my predictions
          </button>
        )}

        {/* Everyone's predictions */}
        <section className="card p-4">
          <p className="text-xs uppercase tracking-wider font-bold text-court-800 mb-3">
            The room&rsquo;s thoughts
          </p>
          <div className="flex flex-col gap-2">
            {predictions.length === 0 && (
              <p className="text-sm text-muted">No one&rsquo;s called it yet.</p>
            )}
            {predictions.map((p) => {
              const champ = players.find((x) => x.id === p.championId);
              return (
                <motion.div
                  key={p.id}
                  layout
                  className="flex items-center gap-3 text-xs"
                >
                  <span className="font-semibold w-20 truncate">
                    {p.userName}
                  </span>
                  <span className="text-muted">picks</span>
                  {champ && (
                    <span className="flex items-center gap-1 font-semibold">
                      <Avatar name={champ.name} photoURL={champ.photoURL} size={20} />
                      {champ.name.split(" ")[0]}
                    </span>
                  )}
                  {p.ayushiPlacement && (
                    <span className="ml-auto chip">A @ #{p.ayushiPlacement}</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-full bg-sand/70 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-sm">{title}</p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
