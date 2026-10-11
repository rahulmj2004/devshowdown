"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type ToastTone = "info" | "success" | "danger";

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

/** Announces the outcome of something the visitor just did. */
export function useToast() {
  return useContext(ToastContext);
}

const icons = { info: Info, success: CircleCheck, danger: CircleAlert };
const tones: Record<ToastTone, string> = {
  info: "border-cyan/40 [&_svg:first-child]:text-cyan",
  success: "border-lime/50 [&_svg:first-child]:text-lime",
  danger: "border-danger/50 [&_svg:first-child]:text-danger",
};

const LIFETIME_MS = 5500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), LIFETIME_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[72] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = toast.tone ?? "info";
            const Icon = icons[tone];
            return (
              <motion.div
                key={toast.id}
                layout
                role={tone === "danger" ? "alert" : "status"}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-surface-2/95 p-4 text-sm shadow-[0_24px_60px_-20px_#000] backdrop-blur",
                  tones[tone],
                )}
              >
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 leading-relaxed text-muted">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="-m-1 rounded p-1 text-subtle transition-colors hover:text-fg"
                >
                  <span className="sr-only">Dismiss notification</span>
                  <X aria-hidden="true" className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
