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
import {
  MIN_PLAYERS_FOR_ROUND,
  generateAmericanoRound,
  type PlayerStanding,
} from "@/lib/americano";
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
  if (standings.length < MIN_PLAYERS_FOR_ROUND) {
    throw new Error(
      `Need at least ${MIN_PLAYERS_FOR_ROUND} onboarded players to start (have ${standings.length}).`
    );
  }

  const expectedCurrent = t.currentRound ?? 0;
  const nextNumber = expectedCurrent + 1;
  // The generator auto-caps courts to whatever the pool can fill; we pass the
  // admin's preferred number and let it scale down if there aren't enough
  // onboarded players to cover every court.
  const generated = generateAmericanoRound({
    standings,
    courts: t.courts,
    roundNumber: nextNumber,
  });

  // Pre-allocate document refs outside the transaction so we can use `tx.set`.
  const roundRef = doc(collection(db, "rounds"));
  const matchRefs = generated.matches.map(() => doc(collection(db, "matches")));

  // Serialize the write behind a transaction that re-reads `currentRound` to
  // prevent two admins tapping "Generate" simultaneously and creating two
  // rounds with the same `number`.
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(tRef);
    if (!fresh.exists()) throw new Error("Tournament not initialized.");
    const freshCurrent = (fresh.data().currentRound as number | undefined) ?? 0;
    if (freshCurrent !== expectedCurrent) {
      throw new Error(
        "Someone else just generated a round. Refresh and try again."
      );
    }

    tx.set(roundRef, {
      number: nextNumber,
      resting: generated.resting,
      matchIds: matchRefs.map((m) => m.id),
      status: "upcoming",
      startedAt: null,
    });

    generated.matches.forEach((m, idx) => {
      tx.set(matchRefs[idx]!, {
        roundId: roundRef.id,
        roundNumber: nextNumber,
        court: m.court,
        teamA: m.teamA,
        teamB: m.teamB,
        status: "upcoming",
      });
    });

    tx.update(tRef, {
      currentRound: nextNumber,
      status: "live",
    });
  });

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

    // Derive win/loss flags, treating ties as neither (no win, no loss).
    const winLossFor = (sA: number, sB: number) => ({
      wonA: sA > sB ? 1 : 0,
      wonB: sB > sA ? 1 : 0,
      lossA: sA < sB ? 1 : 0,
      lossB: sB < sA ? 1 : 0,
    });
    const prev = prevCompleted
      ? winLossFor(prevA, prevB)
      : { wonA: 0, wonB: 0, lossA: 0, lossB: 0 };
    const cur = winLossFor(scoreA, scoreB);

    const playerRefs = playerIds.map((pid) => doc(db, "players", pid));
    const playerSnaps = await Promise.all(playerRefs.map((r) => tx.get(r)));

    playerSnaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const pid = playerIds[i]!;
      const onA = match.teamA.includes(pid);
      const basePrevA = prevCompleted ? prevA : 0;
      const basePrevB = prevCompleted ? prevB : 0;

      const deltaFor = onA ? scoreA - basePrevA : scoreB - basePrevB;
      const deltaAgainst = onA ? scoreB - basePrevB : scoreA - basePrevA;
      const deltaPoints = deltaFor;
      const deltaWins = onA ? cur.wonA - prev.wonA : cur.wonB - prev.wonB;
      const deltaLosses = onA ? cur.lossA - prev.lossA : cur.lossB - prev.lossB;
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
  const tSnap = await getDoc(tRef);
  const previousAyushiId =
    tSnap.exists() && typeof tSnap.data().ayushiId === "string"
      ? (tSnap.data().ayushiId as string)
      : null;

  const batch = writeBatch(db);
  // setDoc with merge: true creates the doc if missing, otherwise patches it.
  batch.set(tRef, { ayushiId: userId }, { merge: true });
  if (previousAyushiId && previousAyushiId !== userId) {
    batch.update(doc(db, "players", previousAyushiId), { isAyushi: false });
  }
  batch.update(doc(db, "players", userId), { isAyushi: true });
  await batch.commit();
}
