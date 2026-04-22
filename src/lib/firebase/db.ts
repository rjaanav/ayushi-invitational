"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit as limitFn,
  type QueryConstraint,
} from "firebase/firestore";
import { getDb } from "./client";
import type {
  BirthdayMessage,
  Match,
  Memory,
  Player,
  Round,
  Tournament,
} from "@/lib/types";
import { useEffect, useState } from "react";

type WithoutId<T> = Omit<T, "id">;

function mapDoc<T>(id: string, data: unknown): T {
  return { id, ...(data as WithoutId<T>) } as T;
}

export function useCollection<T extends { id: string }>(
  path: string,
  opts?: { constraints?: QueryConstraint[]; enabled?: boolean }
) {
  const enabled = opts?.enabled ?? true;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `${path}|${(opts?.constraints ?? []).map((c) => JSON.stringify((c as unknown as { _query?: unknown })._query ?? "")).join("|")}`;
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const db = getDb();
      const ref = collection(db, path);
      const q = opts?.constraints
        ? query(ref, ...opts.constraints)
        : query(ref);
      const unsub = onSnapshot(
        q,
        (snap) => {
          const arr: T[] = snap.docs.map((d) => mapDoc<T>(d.id, d.data()));
          setItems(arr);
          setLoading(false);
        },
        () => setLoading(false)
      );
      return () => unsub();
    } catch {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { items, loading };
}

export function useDocument<T extends { id: string }>(
  path: string,
  id: string | null | undefined
) {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    try {
      const db = getDb();
      const ref = doc(db, path, id);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) setItem(mapDoc<T>(snap.id, snap.data()));
          else setItem(null);
          setLoading(false);
        },
        () => setLoading(false)
      );
      return () => unsub();
    } catch {
      setLoading(false);
    }
  }, [path, id]);
  return { item, loading };
}

export function usePlayers() {
  return useCollection<Player>("players", {
    constraints: [orderBy("points", "desc")],
  });
}

export function useTournament() {
  return useDocument<Tournament>("tournament", "main");
}

export function useRounds(limit?: number) {
  return useCollection<Round>("rounds", {
    constraints: limit
      ? [orderBy("number", "asc"), limitFn(limit)]
      : [orderBy("number", "asc")],
  });
}

export function useMatches() {
  return useCollection<Match>("matches", {
    constraints: [orderBy("roundNumber", "asc"), orderBy("court", "asc")],
  });
}

export function useMemories() {
  return useCollection<Memory>("memories", {
    constraints: [orderBy("createdAt", "desc"), limitFn(200)],
  });
}

export function useBirthdayMessages() {
  return useCollection<BirthdayMessage>("birthdayMessages", {
    constraints: [orderBy("createdAt", "desc")],
  });
}
