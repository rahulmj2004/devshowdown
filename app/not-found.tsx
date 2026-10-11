import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-28 text-center sm:py-36">
      <p className="font-mono text-sm text-violet-bright">
        <span aria-hidden="true" className="text-subtle">
          ${" "}
        </span>
        exit 404
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-fg sm:text-6xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
        That path does not lead anywhere. The competitions are this way.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Back home</ButtonLink>
        <ButtonLink href="/events" variant="secondary">
          Explore events
        </ButtonLink>
      </div>
    </div>
  );
}
