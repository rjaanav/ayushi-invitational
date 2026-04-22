/**
 * Americano-style padel scheduling.
 *
 * The mechanic is built to run cleanly for ANY N >= 4 onboarded players with
 * any configured court count (1..∞). Key rules we implement:
 *
 *  - Each court hosts a 2v2 match (4 players per court).
 *  - `effectiveCourts = min(configuredCourts, floor(N / 4))` so we never try
 *    to schedule more courts than the player pool can fill. Minimum 1 court.
 *  - Players who aren't placed on a court sit out and go into the "resters"
 *    pool for that round. Rest is rotated fairly by past-rest count.
 *  - After round 1, teams are balanced on-court by spreading standings across
 *    courts (top, 2nd, 3rd, …), then pairing top+bottom within each court.
 *  - We try to avoid back-to-back partnerships when possible.
 *
 * The generator NEVER throws for a tournament with >= 4 onboarded players;
 * it simply scales courts down automatically. Callers can inspect
 * `effectiveCourts` on the returned round.
 */

export interface PlayerStanding {
  id: string;
  points: number; // total points
  matchesPlayed: number;
  restsCount: number;
  partnerCounts: Record<string, number>; // partnerId -> times partnered
}

export interface GeneratedMatch {
  court: number;
  teamA: [string, string];
  teamB: [string, string];
}

export interface GeneratedRound {
  /** Player ids sitting out this round. */
  resting: string[];
  matches: GeneratedMatch[];
  /** Court count we actually used (may be < configured courts). */
  effectiveCourts: number;
}

/** Minimum players required to generate any round at all. */
export const MIN_PLAYERS_FOR_ROUND = 4;

export function effectiveCourtsFor(
  playerCount: number,
  configuredCourts: number
): number {
  if (playerCount < MIN_PLAYERS_FOR_ROUND) return 0;
  const capped = Math.min(configuredCourts, Math.floor(playerCount / 4));
  return Math.max(1, capped);
}

function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Pick players who should sit out this round. Priority:
 *   1. Fewest rests so far (everyone should rest an equal number of times).
 *   2. Among ties, rotate by id+roundNumber so the same player doesn't get
 *      pinned as the rester when the field is small.
 *
 * When multiple players have never rested and we need only a subset, we pick
 * a pseudo-random slice (deterministic on roundNumber) so the rotation feels
 * fair night-to-night.
 */
function pickResters(
  standings: PlayerStanding[],
  restCount: number,
  roundNumber: number
): PlayerStanding[] {
  if (restCount <= 0) return [];

  // Bucket by restsCount ascending. Within each bucket, rotate by roundNumber
  // so small fields don't repeatedly rest the same players.
  const buckets = new Map<number, PlayerStanding[]>();
  for (const s of standings) {
    const key = s.restsCount;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }
  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);

  const out: PlayerStanding[] = [];
  for (const k of sortedKeys) {
    const bucket = buckets.get(k)!;
    // Stable but rotated ordering: sort by id, then offset by roundNumber.
    const ordered = bucket.slice().sort((a, b) => a.id.localeCompare(b.id));
    const offset = ((roundNumber - 1) * 31) % ordered.length;
    const rotated = ordered.slice(offset).concat(ordered.slice(0, offset));
    for (const p of rotated) {
      if (out.length >= restCount) break;
      out.push(p);
    }
    if (out.length >= restCount) break;
  }
  return out;
}

/**
 * Distribute the playing pool across courts so each court has a wide spread
 * (top of pool, middle-top, middle-bottom, bottom). For round 1 (or any
 * tie-heavy situation) we fall back to a shuffle.
 */
function orderPlayingPool(
  pool: PlayerStanding[],
  roundNumber: number,
  rng: () => number
): PlayerStanding[] {
  // Detect "no signal yet" — if every player has identical points AND identical
  // matches played, sorting is a no-op and we should just shuffle.
  const allEqual =
    pool.length > 0 &&
    pool.every(
      (p) =>
        p.points === pool[0]!.points &&
        p.matchesPlayed === pool[0]!.matchesPlayed
    );

  if (roundNumber <= 1 || allEqual) {
    return shuffle(pool, rng);
  }
  return [...pool].sort((a, b) => b.points - a.points);
}

export function generateAmericanoRound(params: {
  standings: PlayerStanding[];
  courts: number;
  roundNumber: number; // 1-indexed
  rng?: () => number;
}): GeneratedRound {
  const { standings, courts: configuredCourts, roundNumber } = params;
  const rng = params.rng ?? Math.random;

  if (standings.length < MIN_PLAYERS_FOR_ROUND) {
    throw new Error(
      `Need at least ${MIN_PLAYERS_FOR_ROUND} onboarded players to start a round.`
    );
  }

  const effectiveCourts = effectiveCourtsFor(standings.length, configuredCourts);
  const playersPerRound = effectiveCourts * 4;
  const restCount = standings.length - playersPerRound;

  const resters = pickResters(standings, restCount, roundNumber);
  const resterIds = new Set(resters.map((r) => r.id));
  const playingPool = standings.filter((s) => !resterIds.has(s.id));

  const ordered = orderPlayingPool(playingPool, roundNumber, rng);

  // Snake-distribute players across courts so each court gets a mix of
  // strong/mid/weak standings. Court i gets indexes {i, C+i, 2C+i, 3C+i}.
  const courtBuckets: PlayerStanding[][] = Array.from(
    { length: effectiveCourts },
    () => []
  );
  ordered.forEach((p, idx) => {
    const courtIdx = idx % effectiveCourts;
    courtBuckets[courtIdx]!.push(p);
  });

  const matches: GeneratedMatch[] = [];
  courtBuckets.forEach((bucket, i) => {
    // Defensive: bucket should always have exactly 4 at this point, but if
    // something went wrong we'd rather skip than crash.
    if (bucket.length !== 4) return;
    const [p1, p2, p3, p4] = bucket as [
      PlayerStanding,
      PlayerStanding,
      PlayerStanding,
      PlayerStanding,
    ];

    const permutations: Array<{
      teamA: [PlayerStanding, PlayerStanding];
      teamB: [PlayerStanding, PlayerStanding];
    }> = [
      { teamA: [p1, p4], teamB: [p2, p3] }, // top + bottom vs middle two (default Americano)
      { teamA: [p1, p3], teamB: [p2, p4] },
      { teamA: [p1, p2], teamB: [p3, p4] },
    ];

    const partnerScore = (a: PlayerStanding, b: PlayerStanding) =>
      (a.partnerCounts[b.id] ?? 0) + (b.partnerCounts[a.id] ?? 0);

    permutations.sort((a, b) => {
      const sa =
        partnerScore(a.teamA[0], a.teamA[1]) +
        partnerScore(a.teamB[0], a.teamB[1]);
      const sb =
        partnerScore(b.teamA[0], b.teamA[1]) +
        partnerScore(b.teamB[0], b.teamB[1]);
      return sa - sb;
    });

    const chosen = permutations[0]!;
    matches.push({
      court: i + 1,
      teamA: [chosen.teamA[0].id, chosen.teamA[1].id],
      teamB: [chosen.teamB[0].id, chosen.teamB[1].id],
    });
  });

  return {
    resting: resters.map((r) => r.id),
    matches,
    effectiveCourts,
  };
}

/**
 * Recommend a default number of rounds based on players & courts. The target
 * is that every player plays enough matches to separate the field.
 */
export function suggestRounds(players: number, courts: number): number {
  const effective = effectiveCourtsFor(players, courts);
  if (effective === 0) return 6;
  const playersPerRound = effective * 4;
  if (players <= playersPerRound) return 6; // no one resting — fast tournament
  const rest = players - playersPerRound;
  // Roughly: enough rounds so each player rests ~2 times total.
  return Math.max(6, Math.round((players * 2) / rest));
}
