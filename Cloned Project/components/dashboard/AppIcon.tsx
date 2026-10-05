"use client";
import { useMemo, useState } from "react";

export default function AppIcon({
  name,
  url,
  size = 40,
  className = "",
  icon = "",
}: {
  name: string;
  url: string;
  size?: number;
  className?: string;
  icon?: string;
}) {
  const proxied = useMemo(
    () => `/api/favicon?url=${encodeURIComponent(url)}&sz=${size}`,
    [url, size]
  );
  const [failed, setFailed] = useState(false);
  const letter = (name || new URL(url).hostname).slice(0, 1).toUpperCase();

  if (failed) {
    return (
      <div
        className={[
          "rounded-lg bg-gradient-to-br from-brand-2 to-brand text-white grid place-items-center",
          className,
        ].join(" ")}
        style={{ width: size, height: size }}
      >
        <span className="text-sm font-semibold">{letter}</span>
      </div>
    );
  }

  return (
    <img
      src={icon || proxied}
      alt={`${name} icon`}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={["", className].join(" ")}
      onError={() => setFailed(true)}
    />
  );
}
