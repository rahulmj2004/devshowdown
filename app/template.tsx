import type { ReactNode } from "react";

/**
 * Templates remount on navigation, so this replays a short CSS fade for each
 * page. It is skipped automatically under prefers-reduced-motion.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
