"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="container-page flex flex-col items-center py-28 text-center sm:py-36"
    >
      <p className="font-mono text-sm text-danger">
        <span aria-hidden="true" className="text-subtle">
          ${" "}
        </span>
        unhandled exception
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
        This page failed to load. You can try again, or head back home.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
