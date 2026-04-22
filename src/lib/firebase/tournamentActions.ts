"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "./client";
import { generateAmericanoRound, type PlayerStanding } from "@/lib/americano";
import type { Match, Player, Round, Tournament } from "@/lib/types";

const TOURNAMENT_ID = "main";

export async function initTournament(params: {
  courts?: number;
  pointsPerMatch?: number;
  totalRounds?: number;
  ayushiId?: string;
  startsAt?: Date;
}) {
  const db = getDb();
  const ref = doc(db, "tournament", TOURNAMENT_ID);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  // Firestore rejects `undefined`. Build the payload conditionally so optional
  // fields are either set to a real value or omitted entirely (never undefined).
  const payload: Record<string, unknown> = {
    name: "The Ayushi Invitational",
    courts: params.courts ?? 3,
    pointsPerMatch: params.pointsPerMatch ?? 24,
    currentRound: 0,
    totalRounds: params.totalRounds ?? 7,
    status: "setup",
    theme: "padel+pink",
    startsAt: params.startsAt ?? null,
    ayushiId: params.ayushiId ?? null,
  };
  await setDoc(ref, payload);
}

export async function updateTournament(patch: Partial<Tournament>) {
  const db = getDb();
  const ref = doc(db, "tournament", TOURNAMENT_ID);
  await updateDoc(ref, patch as Record<string, unknown>);
}

async function getAllPlayers(): Promise<Player[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, "players"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Player, "id">) }));
}

async function buildStandings(): Promise<PlayerStanding[]> {
  const players = await getAllPlayers();
  const db = getDb();
  const matchesSnap = await getDocs(collection(db, "matches"));
  const matches = matchesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) })
  );
  const roundsSnap = await getDocs(collection(db, "rounds"));
  const rounds = roundsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<Round, "id">) })
  );

  const partnerCounts: Record<string, Record<string, number>> = {};
  const restsByPlayer: Record<string, number> = {};

  for (const r of rounds) {
    for (const pid of r.resting ?? []) {
      restsByPlayer[pid] = (restsByPlayer[pid] ?? 0) + 1;
    }
  }

  for (const m of matches) {
    const pairs: Array<[string, string]> = [
      [m.teamA[0], m.teamA[1]],
      [m.teamB[0], m.teamB[1]],
    ];
    for (const [a, b] of pairs) {
      partnerCounts[a] = partnerCounts[a] ?? {};
      partnerCounts[b] = partnerCounts[b] ?? {};
      partnerCounts[a]![b] = (partnerCounts[a]![b] ?? 0) + 1;
      partnerCounts[b]![a] = (partnerCounts[b]![a] ?? 0) + 1;
    }
  }

  return players
    .filter((p) => p.name && p.photoURL) // only onboarded
    .map((p) => ({
      id: p.id,
      points: p.points ?? 0,
      matchesPlayed: p.matchesPlayed ?? 0,
      restsCount: restsByPlayer[p.id] ?? 0,
      partnerCounts: partnerCounts[p.id] ?? {},
    }));
}

export async function generateNextRound() {
  const db = getDb();
  const tRef = doc(db, "tournament", TOURNAMENT_ID);
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) throw new Error("Tournament not initialized.");
  const t = tSnap.data() as Omit<Tournament, "id">;

  const standings = await buildStandings();
  if (standings.length < t.courts * 4) {
    throw new Error(
      `Need at least ${t.courts * 4} onboarded players (have ${standings.length}).`
    );
  }

  const nextNumber = (t.currentRound ?? 0) + 1;
  const generated = generateAmericanoRound({
    standings,
    courts: t.courts,
    roundNumber: nextNumber,
  });

  const batch = writeBatch(db);
  const roundRef = doc(collection(db, "rounds"));
  const matchRefs = generated.matches.map(() => doc(collection(db, "matches")));

  batch.set(roundRef, {
    number: nextNumber,
    resting: generated.resting,
    matchIds: matchRefs.map((m) => m.id),
    status: "upcoming",
    startedAt: null,
  });

  generated.matches.forEach((m, idx) => {
    const ref = matchRefs[idx]!;
    batch.set(ref, {
      roundId: roundRef.id,
      roundNumber: nextNumber,
      court: m.court,
      teamA: m.teamA,
      teamB: m.teamB,
      status: "upcoming",
    });
  });

  batch.update(tRef, {
    currentRound: nextNumber,
    status: "live",
  });

  await batch.commit();
  return { roundId: roundRef.id, number: nextNumber };
}

export async function startRound(roundId: string) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, "rounds", roundId), {
    status: "live",
    startedAt: serverTimestamp(),
  });
  const matchesSnap = await getDocs(
    query(collection(db, "matches"), where("roundId", "==", roundId))
  );
  matchesSnap.docs.forEach((m) => {
    batch.update(m.ref, { status: "live", startedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function completeRound(roundId: string) {
  const db = getDb();
  await updateDoc(doc(db, "rounds", roundId), { status: "completed" });
}

/**
 * Submit a match score. Updates match doc and player stats atomically.
 */
export async function submitMatchScore(params: {
  matchId: string;
  scoreA: number;
  scoreB: number;
}) {
  const { matchId, scoreA, scoreB } = params;
  const db = getDb();
  await runTransaction(db, async (tx) => {
    const matchRef = doc(db, "matches", matchId);
    const matchSnap = await tx.get(matchRef);
    if (!matchSnap.exists()) throw new Error("Match not found.");
    const match = matchSnap.data() as Omit<Match, "id">;

    const prevA = match.scoreA ?? 0;
    const prevB = match.scoreB ?? 0;
    const prevCompleted = match.status === "completed";

    const playerIds = [...match.teamA, ...match.teamB];
    const prevWonA = prevCompleted ? (prevA > prevB ? 1 : 0) : 0;
    const prevWonB = prevCompleted ? (prevB > prevA ? 1 : 0) : 0;

    const wonA = scoreA > scoreB ? 1 : 0;
    const wonB = scoreB > scoreA ? 1 : 0;

    const playerRefs = playerIds.map((pid) => doc(db, "players", pid));
    const playerSnaps = await Promise.all(playerRefs.map((r) => tx.get(r)));

    playerSnaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const pid = playerIds[i]!;
      const onA = match.teamA.includes(pid);
      const deltaPoints =
        (onA ? scoreA - (prevCompleted ? prevA : 0) : scoreB - (prevCompleted ? prevB : 0));
      const deltaFor = onA ? scoreA - (prevCompleted ? prevA : 0) : scoreB - (prevCompleted ? prevB : 0);
      const deltaAgainst = onA
        ? scoreB - (prevCompleted ? prevB : 0)
        : scoreA - (prevCompleted ? prevA : 0);

      const deltaWins = onA
        ? wonA - prevWonA
        : wonB - prevWonB;
      const deltaLosses = onA
        ? (1 - wonA) - (prevCompleted ? 1 - prevWonA : 0)
        : (1 - wonB) - (prevCompleted ? 1 - prevWonB : 0);
      const deltaPlayed = prevCompleted ? 0 : 1;

      tx.update(playerRefs[i]!, {
        points: increment(deltaPoints),
        pointsFor: increment(deltaFor),
        pointsAgainst: increment(deltaAgainst),
        wins: increment(deltaWins),
        losses: increment(deltaLosses),
        matchesPlayed: increment(deltaPlayed),
      });
    });

    tx.update(matchRef, {
      scoreA,
      scoreB,
      status: "completed",
      completedAt: serverTimestamp(),
    });
  });
}

export async function voteMVP(params: {
  matchId: string;
  voterId: string;
  playerId: string;
}) {
  const { matchId, voterId, playerId } = params;
  const db = getDb();
  await updateDoc(doc(db, "matches", matchId), {
    [`mvpVotes.${voterId}`]: playerId,
  });
}

export async function promoteAdmin(userId: string) {
  const db = getDb();
  await updateDoc(doc(db, "players", userId), { isAdmin: true });
}

export async function setAyushi(userId: string) {
  const db = getDb();
  const tRef = doc(db, "tournament", TOURNAMENT_ID);
  // setDoc with merge: true creates the doc if missing, otherwise patches it.
  await setDoc(tRef, { ayushiId: userId }, { merge: true });
  await updateDoc(doc(db, "players", userId), { isAyushi: true });
}
