import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-9 w-9 rounded-2xl court-pattern shadow-lg shadow-court-800/30">
        <span className="absolute inset-0 flex items-center justify-center text-[15px]">
          🎾
        </span>
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-[11px] tracking-[0.22em] uppercase text-court-700 font-semibold">
            The
          </div>
          <div className="font-display text-lg text-ink">
            Ayushi <span className="text-pink-500">Invitational</span>
          </div>
        </div>
      )}
    </div>
  );
}
