"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { LiveScoring } from "@/components/LiveScoring";

/**
 * Public live-tournament view. Mounts the same LiveScoring component the
 * admin uses on /admin — it self-adapts based on the viewer's role, so
 * non-admins see every round, match and score in read-only form, while
 * admins would still see the +/- and submit controls if they land here.
 */
export default function SchedulePage() {
  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted"
          >
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
        <LiveScoring />
      </main>
      <BottomNav />
    </div>
  );
}
