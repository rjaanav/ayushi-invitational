/**
 * Event-wide constants. Tweak these to personalize the app.
 * NEXT_PUBLIC_EVENT_START_ISO can override the start time via env (recommended).
 */

const defaultStart = "2026-04-28T22:00:00+05:30"; // 10 PM on 28th IST

export const EVENT = {
  name: "The Ayushi Invitational",
  tagline: "A one-night Americano tournament. For the birthday girl. ✨",
  start: new Date(
    process.env.NEXT_PUBLIC_EVENT_START_ISO ?? defaultStart
  ),
  defaultCourts: 3,
  defaultPointsPerMatch: 24,
  primaryEmoji: "🎾",
};
