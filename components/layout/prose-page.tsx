import type { ReactNode } from "react";

/** Narrow reading column for text-heavy pages (rules, privacy). */
export function ProsePage({ children }: { children: ReactNode }) {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="max-w-2xl space-y-10 text-base leading-relaxed text-muted [&_a]:rounded [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-violet-bright [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-2">
        {children}
      </div>
    </div>
  );
}
