"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Trophy,
  Camera,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";

type NavTab = {
  href: string;
  label: string;
  icon: typeof Home;
};

const BASE_TABS: NavTab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/memories", label: "Memories", icon: Camera },
  { href: "/messages", label: "For Ayushi", icon: Heart },
];

export function BottomNav() {
  const pathname = usePathname();
  const { player } = useAuth();

  const tabs: NavTab[] = [...BASE_TABS];
  if (player?.isAdmin) {
    tabs.push({ href: "/admin", label: "Score", icon: Trophy });
  }

  const hiddenOn = ["/login", "/onboarding"];
  if (hiddenOn.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
      style={{
        background: "linear-gradient(180deg, transparent, rgba(255,249,245,0.85) 25%)",
      }}
    >
      <div className="mx-auto w-full max-w-[480px]">
        <div className="card flex items-center justify-between px-2 py-1.5">
          {tabs.map((t) => {
            const active =
              t.href === "/"
                ? pathname === "/"
                : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors",
                  active
                    ? "text-court-800"
                    : "text-ink-soft/70 hover:text-ink-soft"
                )}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center h-8 w-8 rounded-full",
                    active &&
                      "bg-gradient-to-br from-pink-200 to-pink-100 shadow-inner"
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold tracking-wide",
                    active ? "opacity-100" : "opacity-70"
                  )}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
