"use client";

import posthog from "posthog-js";

export function initPosthog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "https://app.posthog.com",
    person_profiles: "identified_only",
  });
}

export { posthog };
