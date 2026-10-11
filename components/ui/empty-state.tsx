import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-line-strong bg-surface-2 text-violet-bright [&_svg]:size-5">
        {icon}
      </span>
      <p className="mt-5 text-lg font-semibold text-fg">{title}</p>
      {children && (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          {children}
        </div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
