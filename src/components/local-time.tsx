"use client";
// Client Component: only the browser knows the viewer's time zone. The server
// renders a UTC fallback; after hydration this re-renders in local time.

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  // false during SSR and hydration, true afterwards: avoids hydration mismatches
  // without a setState-in-effect round trip.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const date = new Date(iso);

  // dateStyle/timeStyle cannot be combined with timeZoneName, so the UTC suffix is appended by hand.
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(isClient ? {} : { timeZone: "UTC" }),
  }).format(date);
  const text = isClient ? formatted : `${formatted} UTC`;

  return (
    <time dateTime={iso} className={className} title={iso}>
      {text}
    </time>
  );
}
