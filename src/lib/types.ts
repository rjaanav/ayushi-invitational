import type { Timestamp } from "firebase/firestore";

export type TimestampLike = Timestamp | { seconds: number; nanoseconds: number };

export interface Player {
  id: string; // matches auth uid
  phone: string;
  name: string;
  photoURL?: string; // selfie with Ayushi
  joinedAt: TimestampLike;
  isAdmin?: boolean;
  // When true, this player is registered for the night (can post photos +
  // birthday notes, see the leaderboard, hype people up) but is excluded
  // from tournament scheduling and never appears on a court.
  isSpectator?: boolean;
  funFact?: string;
  // Live stats (denormalized for fast reads)
  points: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface Match {
  id: string;
  roundId: string;
  roundNumber: number;
  court: number; // 1..n
  teamA: [string, string]; // player ids
  teamB: [string, string];
  scoreA?: number;
  scoreB?: number;
  status: "upcoming" | "live" | "completed";
  startedAt?: TimestampLike;
  completedAt?: TimestampLike;
  mvpVotes?: Record<string, string>; // voterId -> playerId
}

export interface Round {
  id: string;
  number: number;
  resting: string[]; // player ids resting this round
  matchIds: string[];
  status: "upcoming" | "live" | "completed";
  startedAt?: TimestampLike;
}

export interface Tournament {
  id: "main";
  name: string;
  courts: number; // typically 3
  pointsPerMatch: number; // e.g. 24 (first team to)
  currentRound: number; // 0 means not started
  totalRounds: number;
  status: "setup" | "live" | "completed";
  startedAt?: TimestampLike;
  startsAt?: TimestampLike; // scheduled start (midnight of the 28th)
  theme?: string;
}

export interface Memory {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  imageURL: string;
  caption?: string;
  createdAt: TimestampLike;
  reactions?: Record<string, number>; // emoji -> count
  reactedBy?: Record<string, string>; // userId -> emoji
}

export interface BirthdayMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  message: string;
  createdAt: TimestampLike;
  revealed: boolean;
}
