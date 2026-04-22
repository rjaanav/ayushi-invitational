"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { LiveScoring } from "@/components/LiveScoring";
import { ArrowLeft } from "lucide-react";

export default function SchedulePage() {
  return (
    <div className="flex-1 flex flex-col pb-28">
      <TopBar />
      <main className="flex-1 px-4 pt-4 flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted w-fit"
        >
          <ArrowLeft size={14} /> Home
        </Link>
        <LiveScoring readOnly />
      </main>
      <BottomNav />
    </div>
  );
}
