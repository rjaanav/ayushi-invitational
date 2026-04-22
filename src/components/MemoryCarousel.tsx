"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Camera, Heart, PlusCircle } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useMemories, useBirthdayMessages } from "@/lib/firebase/db";
import type { Memory, BirthdayMessage, TimestampLike } from "@/lib/types";

type PhotoItem = {
  kind: "photo";
  id: string;
  seconds: number;
  memory: Memory;
};

type NoteItem = {
  kind: "note";
  id: string;
  seconds: number;
  message: BirthdayMessage;
};

type Item = PhotoItem | NoteItem;

function toSeconds(ts?: TimestampLike): number {
  if (!ts) return 0;
  if (typeof (ts as { seconds?: number }).seconds === "number") {
    return (ts as { seconds: number }).seconds;
  }
  return 0;
}

function firstName(name?: string): string {
  if (!name) return "Someone";
  return name.trim().split(" ")[0] ?? name;
}

export function MemoryCarousel() {
  const { items: memories } = useMemories();
  const { items: messages } = useBirthdayMessages();

  const items = useMemo<Item[]>(() => {
    const photoItems: Item[] = memories.map((m) => ({
      kind: "photo" as const,
      id: `m-${m.id}`,
      seconds: toSeconds(m.createdAt),
      memory: m,
    }));
    const noteItems: Item[] = messages
      .filter((msg) => msg.message && msg.message.trim().length > 0)
      .map((msg) => ({
        kind: "note" as const,
        id: `n-${msg.id}`,
        seconds: toSeconds(msg.createdAt),
        message: msg,
      }));
    return [...photoItems, ...noteItems]
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 24);
  }, [memories, messages]);

  const hasContent = items.length > 0;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pausedUntilRef = useRef<number>(0);

  useEffect(() => {
    if (!hasContent) return;
    const el = scrollerRef.current;
    if (!el) return;

    // Respect users who asked for reduced motion.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const SPEED_PX_PER_SEC = 18; // gentle ambient drift
    const RESUME_DELAY_MS = 3500; // pause window after user interaction

    let rafId = 0;
    let lastTs = performance.now();

    const pause = () => {
      pausedUntilRef.current = performance.now() + RESUME_DELAY_MS;
    };

    const tick = (ts: number) => {
      const dt = ts - lastTs;
      lastTs = ts;
      const now = performance.now();
      const docVisible =
        typeof document === "undefined" || !document.hidden;
      if (
        docVisible &&
        now >= pausedUntilRef.current &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        const next = el.scrollLeft + (SPEED_PX_PER_SEC * dt) / 1000;
        if (next >= maxScroll - 0.5) {
          // Instant reset avoids fighting with the rAF loop (smooth-scroll
          // would keep animating while our per-frame writes clobber it).
          el.scrollLeft = 0;
          pausedUntilRef.current = now + 1500;
        } else {
          el.scrollLeft = next;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    el.addEventListener("pointerdown", pause, { passive: true });
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("wheel", pause, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("wheel", pause);
    };
  }, [hasContent, items.length]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="-mx-4"
      aria-label="Memories and notes for Ayushi"
    >
      {/* Header */}
      <div className="flex items-end justify-between px-4 mb-3">
        <div>
          <p className="text-[11px] tracking-[0.28em] uppercase text-pink-600/80 font-semibold">
            With love, for Ayushi
          </p>
          <h2 className="font-display text-2xl leading-tight mt-0.5">
            Snaps &amp; notes <span className="text-pink-500">from your people</span>
          </h2>
        </div>
        <Link
          href="/memories"
          className="chip whitespace-nowrap"
          aria-label="See all memories"
        >
          See all <ArrowRight size={12} />
        </Link>
      </div>

      {/* Empty state */}
      {!hasContent && <EmptyState />}

      {/* Scroller */}
      {hasContent && (
        <div
          ref={scrollerRef}
          className="no-scrollbar flex gap-3 overflow-x-auto pb-4 px-4 snap-x snap-proximity"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item, idx) =>
            item.kind === "photo" ? (
              <PhotoCard key={item.id} memory={item.memory} index={idx} />
            ) : (
              <NoteCard key={item.id} message={item.message} index={idx} />
            )
          )}
          {/* Trailing add-your-own card */}
          <AddYourOwnCard />
        </div>
      )}
    </motion.section>
  );
}

function PhotoCard({ memory, index }: { memory: Memory; index: number }) {
  const topReaction = useMemo(() => {
    if (!memory.reactions) return null;
    const entries = Object.entries(memory.reactions)
      .filter(([, count]) => typeof count === "number" && count > 0)
      .sort((a, b) => b[1] - a[1]);
    return entries[0] ?? null;
  }, [memory.reactions]);

  const [imgBroken, setImgBroken] = useState(false);
  const showImage = Boolean(memory.imageURL) && !imgBroken;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.3 }}
      className="relative shrink-0 snap-start rounded-[26px] overflow-hidden shadow-[0_12px_32px_-14px_rgba(17,24,39,0.35)]"
      style={{
        width: "min(74vw, 300px)",
        aspectRatio: "4 / 5",
      }}
    >
      {/* Always-present fallback sitting behind the image. */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-pink-100 to-cream" />
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={memory.imageURL}
          alt={memory.caption ?? `Memory from ${memory.authorName}`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgBroken(true)}
        />
      )}
      {!showImage && (
        <div className="absolute inset-0 flex items-center justify-center text-pink-700/70">
          <Camera size={28} />
        </div>
      )}

      {/* Bottom gradient + meta */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3.5 text-white flex flex-col gap-1.5">
        {memory.caption && (
          <p className="text-sm leading-snug line-clamp-2 drop-shadow-sm">
            {memory.caption}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Avatar
            name={memory.authorName}
            photoURL={memory.authorPhotoURL}
            size={22}
          />
          <p className="text-[11px] font-semibold tracking-wide opacity-95">
            {firstName(memory.authorName)}
          </p>
        </div>
      </div>

      {/* Top reaction badge */}
      {topReaction && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm flex items-center gap-1">
          <span>{topReaction[0]}</span>
          <span className="text-ink tabular-nums">{topReaction[1]}</span>
        </div>
      )}

      {/* Corner tag */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-full h-7 w-7 flex items-center justify-center text-pink-600 shadow-sm">
        <Camera size={14} />
      </div>
    </motion.div>
  );
}

function NoteCard({
  message,
  index,
}: {
  message: BirthdayMessage;
  index: number;
}) {
  // Alternate palettes for visual rhythm across the strip
  const palette = NOTE_PALETTES[index % NOTE_PALETTES.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.3 }}
      className={`relative shrink-0 snap-start rounded-[26px] overflow-hidden shadow-[0_12px_32px_-14px_rgba(17,24,39,0.25)] ${palette.bg}`}
      style={{
        width: "min(74vw, 300px)",
        aspectRatio: "4 / 5",
      }}
    >
      {/* Giant watermark emoji */}
      <div
        className="absolute -top-6 -right-4 text-[140px] leading-none select-none pointer-events-none opacity-[0.12]"
        aria-hidden
      >
        {palette.emoji}
      </div>

      {/* Paper-like inner highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />

      <div className={`relative h-full flex flex-col p-5 ${palette.ink}`}>
        <div className="flex items-center gap-1.5">
          <Heart size={12} className="shrink-0" fill="currentColor" />
          <span className="text-[10px] tracking-[0.28em] uppercase font-semibold opacity-75">
            A note
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center -mt-2">
          <span
            className="font-display text-5xl leading-none opacity-50 select-none"
            aria-hidden
          >
            &ldquo;
          </span>
          <p className="font-display text-[19px] leading-[1.35] line-clamp-[7] -mt-1">
            {message.message}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Avatar
            name={message.authorName}
            photoURL={message.authorPhotoURL}
            size={24}
          />
          <p className="text-[12px] font-semibold opacity-90">
            {firstName(message.authorName)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function AddYourOwnCard() {
  return (
    <Link
      href="/memories"
      className="relative shrink-0 snap-start rounded-[26px] border-2 border-dashed border-pink-300 bg-gradient-to-br from-pink-50 to-white flex flex-col items-center justify-center gap-2 text-pink-700 hover:from-pink-100 transition-colors"
      style={{
        width: "min(74vw, 300px)",
        aspectRatio: "4 / 5",
      }}
    >
      <div className="h-12 w-12 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-md">
        <PlusCircle size={22} />
      </div>
      <p className="font-display text-xl">Add yours</p>
      <p className="text-xs text-pink-600/80 px-6 text-center">
        A snap, a secret, a silly memory — it all counts.
      </p>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mx-4 card p-5 flex items-center gap-4 bg-gradient-to-br from-pink-100 to-white">
      <div className="h-14 w-14 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-inner">
        <Heart size={22} fill="currentColor" />
      </div>
      <div className="flex-1">
        <p className="font-display text-lg leading-tight">
          Be the first to say something.
        </p>
        <p className="text-xs text-muted mt-0.5">
          Drop a selfie on the Memories wall or leave a note for Ayushi.
        </p>
      </div>
      <Link
        href="/memories"
        className="chip whitespace-nowrap"
        aria-label="Add a memory"
      >
        Add
      </Link>
    </div>
  );
}

const NOTE_PALETTES = [
  {
    bg: "bg-gradient-to-br from-pink-200 via-pink-100 to-white",
    ink: "text-pink-900",
    emoji: "💗",
  },
  {
    bg: "bg-gradient-to-br from-turf-300 via-turf-300/60 to-cream",
    ink: "text-court-900",
    emoji: "🎾",
  },
  {
    bg: "bg-gradient-to-br from-sand via-pink-100 to-cream",
    ink: "text-court-900",
    emoji: "✨",
  },
  {
    bg: "bg-gradient-to-br from-amber-100 via-pink-100 to-white",
    ink: "text-ink",
    emoji: "🎂",
  },
];
