/**
 * Event-wide constants. Tweak these to personalize the app.
 * NEXT_PUBLIC_EVENT_START_ISO can override the start time via env (recommended).
 */

const defaultStart = "2026-04-29T00:00:00+05:30"; // midnight on 29th IST

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
