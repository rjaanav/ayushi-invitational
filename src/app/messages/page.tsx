"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Lock, Send } from "lucide-react";
import confetti from "canvas-confetti";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/hooks/useAuth";
import { getDb } from "@/lib/firebase/client";
import { useBirthdayMessages, useTournament } from "@/lib/firebase/db";
import { tsToDate } from "@/lib/utils";

export default function MessagesPage() {
  const { player } = useAuth();
  const { item: tournament } = useTournament();
  const { items: messages, loading } = useBirthdayMessages();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const revealed =
    tournament?.status !== "setup" &&
    (tournament?.startsAt ? Date.now() >= (tsToDate(tournament.startsAt)?.getTime() ?? 0) : true);

  async function send() {
    if (!player) {
      toast.error("Sign in first");
      return;
    }
    if (text.trim().length < 2) {
      toast.error("Say something nice 💕");
      return;
    }
    setBusy(true);
    try {
      const db = getDb();
      await addDoc(collection(db, "birthdayMessages"), {
        authorId: player.id,
        authorName: player.name,
        authorPhotoURL: player.photoURL ?? "",
        message: text.trim(),
        createdAt: serverTimestamp(),
        revealed: true,
      });
      setText("");
      toast.success("Sent with love ✨");
      confetti({
        particleCount: 60,
        spread: 80,
        startVelocity: 35,
        colors: ["#ff7fa3", "#ffb6c6", "#3da668"],
        origin: { y: 0.4 },
      });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <header>
          <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
            For Ayushi
          </p>
          <h1 className="font-display text-3xl">
            Leave her a <span className="text-pink-500">note</span>.
          </h1>
          <p className="text-sm text-muted mt-1 max-w-sm">
            Anything you&rsquo;ve wanted to say. We&rsquo;ll surface these on
            the big screen between rounds.
          </p>
        </header>

        {player && !player.isAyushi && (
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Avatar name={player.name} photoURL={player.photoURL} size={32} />
              <p className="text-sm font-semibold">{player.name}</p>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Happy birthday, A..."
              className="input resize-none"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">{text.length}/500</span>
              <button
                onClick={send}
                disabled={busy}
                className="btn btn-pink"
              >
                <Send size={14} />
                Send to Ayushi
              </button>
            </div>
          </div>
        )}

        {!revealed && (
          <div className="card p-4 bg-gradient-to-br from-court-700 to-court-800 text-white flex items-start gap-3">
            <Lock size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Messages unlock at tip-off</p>
              <p className="text-xs opacity-80 mt-0.5">
                Leave your note now — Ayushi sees everything when the clock
                strikes midnight.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {loading && <div className="skeleton h-24" />}
          {!loading && messages.length === 0 && (
            <div className="card p-6 text-center">
              <Heart className="mx-auto text-pink-500 mb-2" />
              <p className="font-display text-lg">Be the first 🎀</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-4 relative overflow-hidden"
                style={{
                  background:
                    idx % 2 === 0
                      ? "linear-gradient(135deg, #fff, #ffe1e9)"
                      : "linear-gradient(135deg, #fff, #d7efe1)",
                }}
              >
                <div className="absolute -right-4 -top-4 text-6xl opacity-10">
                  {idx % 3 === 0 ? "🎀" : idx % 3 === 1 ? "🎂" : "✨"}
                </div>
                <div className="flex items-start gap-3 relative">
                  <Avatar name={m.authorName} photoURL={m.authorPhotoURL} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-court-800 font-semibold">
                      {m.authorName}
                    </p>
                    <p className="text-sm text-ink-soft mt-1 whitespace-pre-wrap">
                      {revealed || m.authorId === player?.id
                        ? m.message
                        : "🎁 Unlocks at midnight"}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
