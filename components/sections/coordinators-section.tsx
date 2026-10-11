import { Phone } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/config/site";
import { telHref } from "@/lib/utils";
import type { Coordinator } from "@/types";
import { CoordinatorPhoto } from "./coordinator-photo";

function CoordinatorCard({
  coordinator,
  index,
}: {
  coordinator: Coordinator;
  index: number;
}) {
  return (
    <article className="group flex h-full flex-col border border-line bg-surface transition-[border-color,transform,box-shadow] duration-500 ease-out hover:-translate-y-1.5 hover:border-lime/50 hover:shadow-[0_30px_70px_-45px_var(--color-lime)]">
      {/* Every portrait gets the same monochrome grade so the row reads as a set. */}
      <div className="relative aspect-[4/5] overflow-hidden bg-bg">
        <CoordinatorPhoto
          src={coordinator.photo}
          alt={`Portrait of ${coordinator.name}`}
          delay={0.15 + index * 0.12}
        />
        {/* Hover: a light bar scans down the portrait. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/4 -translate-y-full bg-linear-to-b from-transparent via-lime/25 to-transparent opacity-0 transition-[transform,opacity] duration-0 group-hover:translate-y-[400%] group-hover:opacity-100 group-hover:duration-1000 group-hover:ease-out"
        />
        {/* Hover: viewfinder corners close in on the face. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-3 size-4 border-t border-r border-lime/0 transition-all duration-500 ease-out group-hover:top-5 group-hover:right-5 group-hover:size-7 group-hover:border-lime"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 z-10 size-4 border-b border-l border-lime/0 transition-all duration-500 ease-out group-hover:bottom-5 group-hover:left-5 group-hover:size-7 group-hover:border-lime"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-b from-transparent to-surface"
        />
        <p
          aria-hidden="true"
          className="absolute top-3 left-3 bg-bg/70 px-2 py-1 font-mono text-[11px] text-lime backdrop-blur-sm"
        >
          {String(index + 1).padStart(2, "0")}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="eyebrow text-subtle">{coordinator.role}</p>
        <h3 className="mt-2 display text-3xl text-fg">{coordinator.name}</h3>
        <span
          aria-hidden="true"
          className="mt-3 block h-px w-8 bg-lime/70 transition-[width] duration-500 ease-out group-hover:w-20"
        />
        <a
          href={telHref(coordinator.phone)}
          className="mt-5 inline-flex items-center gap-2.5 self-start rounded-[3px] border border-line-strong px-3.5 py-2 font-mono text-sm text-muted transition-colors duration-200 hover:border-lime hover:text-lime"
        >
          <Phone aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Call {coordinator.name}: </span>
          {coordinator.phone}
        </a>
      </div>
    </article>
  );
}

/** The event coordinators and how to reach them, from `siteConfig.coordinators`. */
export function CoordinatorsSection({ index }: { index: string }) {
  const { coordinators } = siteConfig;
  if (coordinators.length === 0) return null;

  return (
    <section
      id="coordinators"
      aria-labelledby="coordinators-heading"
      className="border-t border-line bg-bg-soft"
    >
      <div className="container-page py-24 sm:py-32">
        <SectionHeading
          id="coordinators-heading"
          index={index}
          eyebrow="Coordinators"
          title="Meet the coordinators"
          description="Questions about the event, registration or the competitions? Call any of us."
        />

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coordinators.map((coordinator, index) => (
            <li key={coordinator.name}>
              <Reveal delay={index * 0.08} className="h-full">
                <CoordinatorCard coordinator={coordinator} index={index} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
