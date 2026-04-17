"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/hooks/useAuth";
import { getDb, getFirebaseStorage } from "@/lib/firebase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const { firebaseUser, player, loading } = useAuth();
  const [name, setName] = useState("");
  const [funFact, setFunFact] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    if (player?.name) setName(player.name);
    if (player?.photoURL) setPreview(player.photoURL);
    if (player?.funFact) setFunFact(player.funFact);
  }, [player]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Keep that selfie under 8MB 🎀");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function onSave() {
    if (!firebaseUser) return;
    if (name.trim().length < 2) {
      toast.error("Your name, please ✨");
      return;
    }
    if (!file && !player?.photoURL) {
      toast.error("A selfie with Ayushi is the price of admission 📸");
      return;
    }
    setSaving(true);
    try {
      let photoURL = player?.photoURL ?? "";
      if (file) {
        const storage = getFirebaseStorage();
        const path = `selfies/${firebaseUser.uid}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file, { contentType: file.type });
        photoURL = await getDownloadURL(ref);
      }
      const db = getDb();
      await updateDoc(doc(db, "players", firebaseUser.uid), {
        name: name.trim(),
        photoURL,
        funFact: funFact.trim() || "",
        updatedAt: serverTimestamp(),
      });
      toast.success("You're on the list 🎾");
      router.replace("/");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't save. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col pb-24">
      <div className="px-4 pt-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted">Skip</Link>
        <span className="text-[11px] uppercase tracking-[0.25em] text-court-700 font-semibold">
          Step 1 of 1
        </span>
      </div>

      <main className="flex-1 px-5 pt-6 pb-6 flex flex-col gap-5">
        <div>
          <h1 className="font-display text-3xl leading-tight">
            Let&rsquo;s <span className="text-pink-500">make it official</span>.
          </h1>
          <p className="text-sm text-muted mt-2">
            Your name + a selfie with Ayushi. This is your tournament badge for
            the night.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4 flex flex-col items-center gap-4"
        >
          <button
            onClick={() => inputRef.current?.click()}
            className="relative h-40 w-40 rounded-full bg-gradient-to-br from-pink-200 to-turf-300 overflow-hidden border-4 border-white shadow-xl"
            type="button"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Selfie preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-court-800">
                <Camera size={28} />
                <span className="text-xs mt-1 font-semibold">Tap to add</span>
              </div>
            )}
            <span className="absolute bottom-1 right-1 bg-pink-500 text-white rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-white">
              <Camera size={14} />
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={onFileChange}
            className="hidden"
          />
          <p className="text-xs text-muted text-center max-w-[240px]">
            Take a fresh one together, or pick a favorite. This becomes your
            player avatar all night.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wider text-court-800 font-semibold">
            Your name
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jaanav"
            autoFocus
          />

          <label className="text-xs uppercase tracking-wider text-court-800 font-semibold mt-2">
            Fun fact about you <span className="text-muted">(optional)</span>
          </label>
          <input
            className="input"
            value={funFact}
            onChange={(e) => setFunFact(e.target.value)}
            placeholder="I've never held a padel racket in my life 😅"
          />
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="btn btn-pink mt-4"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Sparkles size={16} />
          )}
          Lock me in
        </button>
      </main>
    </div>
  );
}
