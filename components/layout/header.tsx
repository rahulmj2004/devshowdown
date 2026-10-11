"use client";

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Magnetic } from "@/components/motion/magnetic";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

const sections = siteConfig.nav.map((item) => item.section);

/**
 * Which home-page section is under the middle of the viewport. Off the home
 * page the Events item is lit for /events routes and nothing else is.
 */
function useActiveSection(pathname: string): string | null {
  const [visible, setVisible] = useState<string>("top");
  const onHome = pathname === "/";

  useEffect(() => {
    if (!onHome) return;
    const targets = sections
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setVisible(entry.target.id);
        }
      },
      // A thin band across the middle of the viewport.
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [onHome]);

  if (onHome) return visible;
  return pathname.startsWith("/events") ? "events" : null;
}

export function Header() {
  const pathname = usePathname();
  const active = useActiveSection(pathname);
  const reduceMotion = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-line bg-bg/80 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="relative container-page flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={`${siteConfig.name} home`}
          className="rounded-sm"
        >
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center">
            {siteConfig.nav.map((item) => {
              const isActive = active === item.section;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "relative block px-3.5 py-2 eyebrow transition-colors duration-200",
                      isActive ? "text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        aria-hidden="true"
                        className="absolute inset-x-3.5 -bottom-0.5 h-0.5 bg-lime"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 420, damping: 36 }
                        }
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Magnetic className="hidden sm:inline-flex">
            <ButtonLink href="/register" size="sm">
              Register
            </ButtonLink>
          </Magnetic>
          <MobileNav items={siteConfig.nav} active={active} />
        </div>
      </div>

      {/* Reading progress, drawn along the header's bottom edge. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px h-px origin-left bg-lime/70"
        style={{ scaleX: scrollYProgress, opacity: scrolled ? 1 : 0 }}
      />
    </header>
  );
}
