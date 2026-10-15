"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  section: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function MobileNav({
  items,
  active,
  registrationOpen,
}: {
  items: readonly NavItem[];
  active: string | null;
  registrationOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // The menu covers the page, so the page behind it should not scroll.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const step = reduceMotion ? 0 : 0.055;

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex size-10 items-center justify-center rounded-[3px] border border-line-strong text-fg transition-colors hover:border-lime"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <span aria-hidden="true" className="relative block h-3 w-5">
          <span
            className={cn(
              "absolute left-0 h-0.5 w-5 bg-current transition-transform duration-300 ease-out",
              open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0",
            )}
          />
          <span
            className={cn(
              "absolute left-0 h-0.5 bg-current transition-[transform,width] duration-300 ease-out",
              open ? "top-1/2 w-5 -translate-y-1/2 -rotate-45" : "bottom-0 w-3",
            )}
          />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-bg/97 backdrop-blur-xl"
            initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
            animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE }}
          >
            <nav
              aria-label="Mobile"
              className="container-page flex min-h-full flex-col py-8"
            >
              <ul className="flex flex-col">
                {items.map((item, index) => (
                  <motion.li
                    key={item.href}
                    className="overflow-hidden border-b border-line"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.55,
                      delay: 0.08 + index * step,
                      ease: EASE,
                    }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={
                        active === item.section ? "true" : undefined
                      }
                      className={cn(
                        "flex items-baseline justify-between gap-4 py-4 display text-4xl transition-colors",
                        active === item.section
                          ? "text-lime"
                          : "text-fg hover:text-lime",
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden="true"
                        className="font-mono text-xs tracking-widest text-subtle"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.55,
                  delay: 0.08 + items.length * step,
                  ease: EASE,
                }}
              >
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className={buttonClasses({ size: "lg", className: "w-full" })}
                >
                  {registrationOpen ? "Register" : "Registrations Closed"}
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
