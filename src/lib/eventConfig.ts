/**
 * Event-wide constants. Tweak these to personalize the app.
 * NEXT_PUBLIC_EVENT_START_ISO can override the start time via env (recommended).
 */

const defaultStart = "2026-04-28T00:00:00+05:30"; // midnight on 28th IST

export const EVENT = {
  name: "The Ayushi Invitational",
  tagline: "A one-night, 14-player Americano. For the birthday girl. ✨",
  start: new Date(
    process.env.NEXT_PUBLIC_EVENT_START_ISO ?? defaultStart
  ),
  maxPlayers: 14,
  defaultCourts: 3,
  defaultPointsPerMatch: 24,
  primaryEmoji: "🎾",
};
