"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, Plus } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/hooks/useAuth";
import { getDb, getFirebaseStorage } from "@/lib/firebase/client";
import { useMemories } from "@/lib/firebase/db";
import { tsToDate, cn } from "@/lib/utils";

const REACTIONS = ["❤️", "🎾", "🔥", "😂", "👑", "🤌"];

export default function MemoriesPage() {
  const { player } = useAuth();
  const { items: memories, loading } = useMemories();
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
              Memory Wall
            </p>
            <h1 className="font-display text-3xl">
              Tonight, <span className="text-pink-500">captured</span>.
            </h1>
            <p className="text-sm text-muted mt-1 max-w-xs">
              Post your candids, rallies, and group shots. Ayushi gets to
              scroll through this for the rest of her life.
            </p>
          </div>
        </header>

        {player && (
          <button
            onClick={() => setComposerOpen(true)}
            className="card p-3 flex items-center gap-3 hover:bg-white/60 text-left"
          >
            <div className="h-10 w-10 rounded-full bg-pink-200 text-pink-800 flex items-center justify-center">
              <Plus />
            </div>
            <div>
              <p className="font-semibold text-sm">Post a memory</p>
              <p className="text-xs text-muted">Photo + caption</p>
            </div>
          </button>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-40" />
            <div className="skeleton h-40" />
          </div>
        )}

        {!loading && memories.length === 0 && (
          <div className="card p-8 text-center">
            <Camera className="mx-auto text-court-700 mb-2" />
            <p className="font-display text-xl">No memories yet</p>
            <p className="text-sm text-muted mt-1">
              Be the first to drop a shot ✨
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} myId={player?.id} />
          ))}
        </div>
      </main>

      <AnimatePresence>
        {composerOpen && player && (
          <ComposerSheet
            onClose={() => setComposerOpen(false)}
            author={{
              id: player.id,
              name: player.name,
              photoURL: player.photoURL,
            }}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

function MemoryCard({
  memory,
  myId,
}: {
  memory: import("@/lib/types").Memory;
  myId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const my = myId ? memory.reactedBy?.[myId] : undefined;

  async function react(emoji: string) {
    if (!myId) return;
    setBusy(true);
    try {
      const db = getDb();
      const ref = doc(db, "memories", memory.id);
      const prev = my;
      const patch: Record<string, unknown> = {
        [`reactedBy.${myId}`]: emoji,
        [`reactions.${emoji}`]: increment(1),
      };
      if (prev && prev !== emoji) {
        patch[`reactions.${prev}`] = increment(-1);
      } else if (prev === emoji) {
        patch[`reactedBy.${myId}`] = null;
        patch[`reactions.${emoji}`] = increment(-1);
      }
      await updateDoc(ref, patch);
    } catch {
      toast.error("Couldn't react.");
    } finally {
      setBusy(false);
    }
  }

  const date = tsToDate(memory.createdAt);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden flex flex-col"
    >
      <div className="aspect-square overflow-hidden bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={memory.imageURL}
          alt={memory.caption ?? ""}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-2.5 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={memory.authorName} photoURL={memory.authorPhotoURL} size={22} />
          <p className="text-[11px] font-semibold truncate flex-1">
            {memory.authorName}
          </p>
          {date && (
            <p className="text-[10px] text-muted">
              {date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        {memory.caption && (
          <p className="text-xs text-ink-soft line-clamp-2">{memory.caption}</p>
        )}
        <div className="flex gap-1 flex-wrap">
          {REACTIONS.map((e) => {
            const count = memory.reactions?.[e] ?? 0;
            return (
              <button
                key={e}
                onClick={() => react(e)}
                disabled={busy}
                className={cn(
                  "text-xs px-1.5 py-1 rounded-full border transition-all",
                  my === e
                    ? "bg-pink-300/50 border-pink-400"
                    : "bg-white border-black/5"
                )}
              >
                {e}
                {count > 0 && <span className="ml-1 text-[10px]">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function ComposerSheet({
  onClose,
  author,
}: {
  onClose: () => void;
  author: { id: string; name: string; photoURL?: string };
}) {
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function onFile(f: File) {
    if (f.size > 15 * 1024 * 1024) {
      toast.error("Keep it under 15MB pls");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) {
      toast.error("Add a photo first.");
      return;
    }
    setBusy(true);
    try {
      const storage = getFirebaseStorage();
      const path = `memories/${author.id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      const db = getDb();
      await addDoc(collection(db, "memories"), {
        authorId: author.id,
        authorName: author.name,
        authorPhotoURL: author.photoURL ?? "",
        imageURL: url,
        caption: caption.trim() || "",
        createdAt: serverTimestamp(),
        reactions: {},
        reactedBy: {},
      });
      toast.success("Posted 🎾");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 24, stiffness: 220 }}
        className="w-full max-w-[480px] bg-cream rounded-t-3xl p-5 pb-8 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-black/10 mx-auto" />
        <h2 className="font-display text-2xl">Post a memory</h2>

        <button
          onClick={() => inputRef.current?.click()}
          className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-pink-200 to-turf-300 flex items-center justify-center"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <div className="text-court-800 flex flex-col items-center">
              <Camera size={28} />
              <span className="text-sm font-semibold mt-1">Tap to pick</span>
            </div>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="hidden"
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          placeholder="Caption (optional) — keep it spicy ✨"
          className="input resize-none"
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !file} className="btn btn-pink flex-1">
            {busy ? <Loader2 className="animate-spin" size={16} /> : "Post"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
