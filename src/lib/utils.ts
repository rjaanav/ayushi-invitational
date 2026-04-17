import type { TimestampLike } from "@/lib/types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function tsToDate(ts?: TimestampLike | null): Date | null {
  if (!ts) return null;
  const seconds = (ts as { seconds?: number }).seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  return null;
}

export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function formatPhone(raw: string): string {
  if (!raw) return "";
  return raw.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d+)/, "$1 $2 $3 $4");
}

export function formatClock(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

const SAFE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "lh3.googleusercontent.com",
]);

/**
 * Accept data URLs and https URLs only for rendering avatars/photos.
 */
export function isSafeImageURL(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (SAFE_HOSTS.has(u.host) || u.host.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}
