import type { Timestamp } from "firebase/firestore";

export type TimestampLike = Timestamp | { seconds: number; nanoseconds: number };

export interface Player {
  id: string; // matches auth uid
  phone: string;
  name: string;
  photoURL?: string; // selfie with Ayushi
  joinedAt: TimestampLike;
  isAdmin?: boolean;
  isAyushi?: boolean;
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
  ayushiId?: string;
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

export interface Prediction {
  id: string; // userId
  userId: string;
  userName: string;
  championId?: string; // predicted winner
  ayushiPlacement?: number; // 1..N where N = onboarded player count
  mvpId?: string;
  createdAt: TimestampLike;
}
