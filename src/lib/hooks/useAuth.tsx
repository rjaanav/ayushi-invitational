"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ConfirmationResult,
  type User,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  getFirebaseAuth,
  getDb,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import type { Player } from "@/lib/types";

interface AuthContextValue {
  firebaseUser: User | null;
  player: Player | null;
  loading: boolean;
  configured: boolean;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<User>;
  signOut: () => Promise<void>;
  resetOtp: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (!u) {
        setPlayer(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, [configured]);

  useEffect(() => {
    if (!firebaseUser || !configured) return;
    const db = getDb();
    const ref = doc(db, "players", firebaseUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setPlayer({ id: snap.id, ...(snap.data() as Omit<Player, "id">) });
        } else {
          setPlayer(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [firebaseUser, configured]);

  const resetOtp = useCallback(() => {
    confirmationRef.current = null;
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch {}
      recaptchaRef.current = null;
    }
    const el = document.getElementById("recaptcha-container");
    if (el) el.innerHTML = "";
  }, []);

  const sendOtp = useCallback(
    async (phone: string) => {
      if (!configured)
        throw new Error("Firebase not configured. See README to set it up.");
      const auth = getFirebaseAuth();
      resetOtp();
      if (!document.getElementById("recaptcha-container")) {
        const div = document.createElement("div");
        div.id = "recaptcha-container";
        document.body.appendChild(div);
      }
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      recaptchaRef.current = verifier;
      const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
      confirmationRef.current = confirmation;
    },
    [configured, resetOtp]
  );

  const verifyOtp = useCallback(
    async (code: string): Promise<User> => {
      if (!confirmationRef.current)
        throw new Error("No OTP requested yet. Please request a new code.");
      const cred = await confirmationRef.current.confirm(code);
      const user = cred.user;
      // upsert minimal player record so onboarding knows who they are
      const db = getDb();
      const ref = doc(db, "players", user.uid);
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          phone: user.phoneNumber ?? "",
          name: "",
          joinedAt: serverTimestamp(),
          points: 0,
          wins: 0,
          losses: 0,
          matchesPlayed: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        });
      }
      resetOtp();
      return user;
    },
    [resetOtp]
  );

  const signOut = useCallback(async () => {
    if (!configured) return;
    await fbSignOut(getFirebaseAuth());
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      player,
      loading,
      configured,
      sendOtp,
      verifyOtp,
      signOut,
      resetOtp,
    }),
    [firebaseUser, player, loading, configured, sendOtp, verifyOtp, signOut, resetOtp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
