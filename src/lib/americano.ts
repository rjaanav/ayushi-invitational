/**
 * Americano-style padel scheduling.
 *
 * Rules we implement:
 * - N players, C courts (4 players per court). Each round, C*4 play, rest sit out.
 * - After round 1, pairings are generated based on current standings so that
 *   teams are balanced (top + bottom player vs 2nd + 2nd-to-last, etc.).
 * - We avoid repeating partnerships when possible (same partner in consecutive rounds).
 * - Rest rotation is even across rounds.
 *
 * Points are individual: both teammates earn the team's score per match.
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
  resting: string[];
  matches: GeneratedMatch[];
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
 * Pick players who should sit out this round: those with the fewest rests so far.
 */
function pickResters(
  standings: PlayerStanding[],
  restCount: number
): PlayerStanding[] {
  if (restCount <= 0) return [];
  const byRest = [...standings].sort((a, b) => {
    if (a.restsCount !== b.restsCount) return a.restsCount - b.restsCount;
    // after equal rests, prefer those with more points to rest (give low-performers more play)
    return b.points - a.points;
  });
  return byRest.slice(0, restCount);
}

/**
 * Team split: classic Americano pairs strongest + weakest, etc. within each court.
 * We group the playing pool of 4C players by current standing (random for round 1),
 * then distribute to courts so each court has a balanced spread, and pair
 * top+bottom of each court as partners.
 */
export function generateAmericanoRound(params: {
  standings: PlayerStanding[];
  courts: number;
  roundNumber: number; // 1-indexed
  rng?: () => number;
}): GeneratedRound {
  const { standings, courts, roundNumber } = params;
  const rng = params.rng ?? Math.random;
  const playersPerRound = courts * 4;
  if (standings.length < playersPerRound) {
    throw new Error(
      `Need at least ${playersPerRound} players for ${courts} courts.`
    );
  }

  const restCount = standings.length - playersPerRound;
  const resters = pickResters(standings, restCount);
  const resterIds = new Set(resters.map((r) => r.id));
  const playingPool = standings.filter((s) => !resterIds.has(s.id));

  // Order the playing pool: round 1 shuffle, later rounds by points desc.
  let ordered: PlayerStanding[];
  if (roundNumber <= 1) {
    ordered = shuffle(playingPool, rng);
  } else {
    ordered = [...playingPool].sort((a, b) => b.points - a.points);
  }

  // Distribute players to courts so each court has a wide spread.
  // Court i gets positions: i, courts+i, 2*courts+i, 3*courts+i (snake-like).
  const courtBuckets: PlayerStanding[][] = Array.from({ length: courts }, () => []);
  ordered.forEach((p, idx) => {
    const courtIdx = idx % courts;
    courtBuckets[courtIdx]!.push(p);
  });

  const matches: GeneratedMatch[] = [];
  courtBuckets.forEach((bucket, i) => {
    // bucket has 4 players. Pair highest + lowest vs middle two by default.
    // Then try a permutation that reduces repeat partnerships.
    const [p1, p2, p3, p4] = bucket;
    if (!p1 || !p2 || !p3 || !p4) return;

    const permutations: Array<{
      teamA: [PlayerStanding, PlayerStanding];
      teamB: [PlayerStanding, PlayerStanding];
    }> = [
      { teamA: [p1, p4], teamB: [p2, p3] },
      { teamA: [p1, p3], teamB: [p2, p4] },
      { teamA: [p1, p2], teamB: [p3, p4] },
    ];

    // score each permutation: lower is better (avoid repeat partners)
    function partnerScore(a: PlayerStanding, b: PlayerStanding) {
      return (a.partnerCounts[b.id] ?? 0) + (b.partnerCounts[a.id] ?? 0);
    }

    permutations.sort((a, b) => {
      const sa = partnerScore(a.teamA[0], a.teamA[1]) + partnerScore(a.teamB[0], a.teamB[1]);
      const sb = partnerScore(b.teamA[0], b.teamA[1]) + partnerScore(b.teamB[0], b.teamB[1]);
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
  };
}

/**
 * Helper to recommend a default number of rounds based on players/courts.
 * For 14 players, 3 courts, and ~20 min/round, 6-8 rounds is a nice target.
 */
export function suggestRounds(players: number, courts: number): number {
  const playersPerRound = courts * 4;
  if (players < playersPerRound) return 6;
  // Each extra rester means more rounds needed for fairness.
  const rest = Math.max(1, players - playersPerRound);
  return Math.max(6, Math.round(players / rest));
}
