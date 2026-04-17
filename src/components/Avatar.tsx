"use client";

import { initials, isSafeImageURL, cn } from "@/lib/utils";

interface AvatarProps {
  name?: string;
  photoURL?: string;
  size?: number;
  ring?: boolean;
  className?: string;
}

export function Avatar({
  name = "",
  photoURL,
  size = 44,
  ring,
  className,
}: AvatarProps) {
  const safe = isSafeImageURL(photoURL);
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full shrink-0",
        "bg-gradient-to-br from-pink-200 via-pink-100 to-turf-300 text-ink-soft font-semibold",
        ring && "ring-2 ring-pink-300 ring-offset-2 ring-offset-cream",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {safe ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoURL}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="tracking-tight">{initials(name).toUpperCase()}</span>
      )}
    </div>
  );
}
