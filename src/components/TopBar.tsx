"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/hooks/useAuth";

export function TopBar() {
  const { player } = useAuth();
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 pb-2 backdrop-blur-md bg-cream/70 border-b border-black/5">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex-1">
          <Logo />
        </Link>
        {player && (
          <Link
            href={`/players/${player.id}`}
            className="flex items-center gap-2"
          >
            <Avatar
              name={player.name}
              photoURL={player.photoURL}
              size={34}
            />
          </Link>
        )}
      </div>
    </header>
  );
}
