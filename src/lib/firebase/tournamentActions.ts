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
    // Eligible to be scheduled = onboarded AND opted in as a participant.
    // Spectators stay registered (they can post photos, leave notes, etc.)
    // but never get pulled into a round.
    .filter((p) => p.name && p.photoURL && !p.isSpectator)
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
 *
 * Scoring rule: a match ends when the CUMULATIVE score across both teams
 * equals `pointsPerMatch` (default 24). Callers should pass `maxTotal` so we
 * can reject invalid scores server-side as a safety net on top of the client
 * UI cap.
 */
export async function submitMatchScore(params: {
  matchId: string;
  scoreA: number;
  scoreB: number;
  maxTotal?: number;
}) {
  const { matchId, scoreA, scoreB, maxTotal } = params;
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    throw new Error("Scores must be numbers.");
  }
  if (scoreA < 0 || scoreB < 0) {
    throw new Error("Scores can't be negative.");
  }
  if (maxTotal !== undefined && scoreA + scoreB > maxTotal) {
    throw new Error(
      `Combined score can't exceed ${maxTotal} (you entered ${scoreA + scoreB}).`
    );
  }
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

/**
 * Flip a player between participant ("on the roster") and spectator
 * ("just here to cheer"). Spectators are excluded from round generation but
 * keep all their other access (memories, birthday messages, leaderboard view).
 */
export async function setSpectator(userId: string, value: boolean) {
  const db = getDb();
  await updateDoc(doc(db, "players", userId), { isSpectator: value });
}

// ---------------------------------------------------------------------------
// Test seeding
// ---------------------------------------------------------------------------

/** Deterministic gradient avatar so seeded players are visually distinct. */
function makeSeedAvatar(name: string, hue: number): string {
  const parts = name.trim().split(/\s+/);
  const letters =
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() ||
    "??";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue}, 78%, 82%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360}, 70%, 62%)"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><text x="50%" y="54%" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="104" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="#0a1620">${letters}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEED_PLAYERS: Array<{ name: string; funFact: string }> = [
  { name: "Ayushi Sharma", funFact: "Birthday girl. Serve her a forehand to the chest and you get uninvited." },
  { name: "Priya Kapoor", funFact: "Can't lose without blaming the wind." },
  { name: "Rohan Mehta", funFact: "Turns every rally into a three-act play." },
  { name: "Arjun Singh", funFact: "Foot-fault connoisseur." },
  { name: "Neha Iyer", funFact: "Secretly plays tennis with her dog every morning." },
  { name: "Kabir Joshi", funFact: "Will ask to review a point on a phone camera." },
  { name: "Ananya Rao", funFact: "Unbeatable when the playlist is on." },
  { name: "Vikram Nair", funFact: "Grip tape maximalist." },
  { name: "Divya Banerjee", funFact: "Returns everything short of a yorker." },
  { name: "Rahul Gupta", funFact: "Celebrates winners with the silent nod." },
  { name: "Tara Verma", funFact: "Overhead smash is a personality trait." },
  { name: "Aditya Menon", funFact: "Court DJ and occasionally the striker." },
  { name: "Shreya Desai", funFact: "Lefty with a sneaky drop shot." },
  { name: "Karan Bhatt", funFact: "Will argue about a line call for 12 minutes." },
];

/**
 * Create 14 deterministic test players for end-to-end testing. Safe to re-run —
 * it uses fixed `seed-*` ids and overwrites stats each time so the field is
 * reset to a clean slate. Real players are never touched.
 */
export async function seedTestPlayers() {
  const db = getDb();
  const batch = writeBatch(db);
  const createdIds: string[] = [];
  SEED_PLAYERS.forEach((p, i) => {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const id = `seed-${String(i + 1).padStart(2, "0")}-${slug}`;
    createdIds.push(id);
    const hue = Math.round((i * (360 / SEED_PLAYERS.length)) % 360);
    const ref = doc(db, "players", id);
    batch.set(
      ref,
      {
        phone: `+1555${String(1000 + i).padStart(7, "0")}`,
        name: p.name,
        photoURL: makeSeedAvatar(p.name, hue),
        funFact: p.funFact,
        isAdmin: false,
        isSeed: true,
        points: 0,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        joinedAt: serverTimestamp(),
      },
      { merge: false }
    );
  });
  await batch.commit();
  return { count: SEED_PLAYERS.length, ids: createdIds };
}

/**
 * Delete every `seed-*` player doc and any matches/rounds that referenced them.
 */
export async function removeTestPlayers() {
  const db = getDb();
  const snap = await getDocs(collection(db, "players"));
  const seeds = snap.docs.filter((d) => d.id.startsWith("seed-"));
  if (seeds.length === 0) return { removed: 0 };

  const seedIds = new Set(seeds.map((d) => d.id));

  // Firestore batches are capped at 500 ops. We may have matches + rounds +
  // players in the hundreds; chunk to be safe.
  const [matchesSnap, roundsSnap] = await Promise.all([
    getDocs(collection(db, "matches")),
    getDocs(collection(db, "rounds")),
  ]);
  const staleMatches = matchesSnap.docs.filter((d) => {
    const m = d.data() as Omit<Match, "id">;
    return (
      m.teamA?.some((id) => seedIds.has(id)) ||
      m.teamB?.some((id) => seedIds.has(id))
    );
  });
  const staleMatchIds = new Set(staleMatches.map((d) => d.id));
  const staleRounds = roundsSnap.docs.filter((d) => {
    const r = d.data() as Omit<Round, "id">;
    return (
      r.resting?.some((id) => seedIds.has(id)) ||
      r.matchIds?.some((id) => staleMatchIds.has(id))
    );
  });

  // Firestore batches cap at 500 ops. Chunk into safe-sized batches.
  const batches: ReturnType<typeof writeBatch>[] = [];
  let current = writeBatch(db);
  let count = 0;
  const addOp = (fn: (b: ReturnType<typeof writeBatch>) => void) => {
    fn(current);
    count++;
    if (count >= 450) {
      batches.push(current);
      current = writeBatch(db);
      count = 0;
    }
  };

  seeds.forEach((d) => addOp((b) => b.delete(d.ref)));
  staleMatches.forEach((d) => addOp((b) => b.delete(d.ref)));
  staleRounds.forEach((d) => addOp((b) => b.delete(d.ref)));

  batches.push(current);
  for (const b of batches) await b.commit();

  return {
    removed: seeds.length,
    matchesRemoved: staleMatches.length,
    roundsRemoved: staleRounds.length,
  };
}
