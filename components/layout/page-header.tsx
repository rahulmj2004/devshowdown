import type { ReactNode } from "react";

/** Shared heading band for inner pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute inset-0 bg-[radial-gradient(44rem_20rem_at_25%_0%,#7b3dff30,transparent_70%)]" />
      </div>
      <div className="container-page py-14 sm:py-20">
        <p className="flex items-center gap-3 eyebrow text-lime">
          <span aria-hidden="true" className="h-px w-8 bg-lime/60" />
          {eyebrow}
        </p>
        <h1 className="mt-5 max-w-4xl display text-5xl text-fg sm:text-7xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
