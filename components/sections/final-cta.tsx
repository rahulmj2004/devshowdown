import { ArrowRight } from "lucide-react";
import { Magnetic } from "@/components/motion/magnetic";
import { ButtonLink } from "@/components/ui/button";
import { Reveal, RevealText } from "@/components/ui/reveal";
import type { RegistrationStatus } from "@/types";

const copy: Record<RegistrationStatus, string> = {
  not_open:
    "Explore the competitions now, and register as soon as registration opens.",
  open: "Registration is open. Explore the competitions and claim your spot.",
  closed:
    "Registration is closed for this edition. You can still explore the competitions.",
};

export function FinalCta({
  registrationStatus,
}: {
  registrationStatus: RegistrationStatus;
}) {
  return (
    <section
      aria-labelledby="cta-heading"
      className="relative isolate overflow-hidden border-t border-line"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute inset-0 bg-[radial-gradient(50rem_26rem_at_50%_0%,#7b3dff38,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40rem_20rem_at_20%_100%,#c8ff2e14,transparent_70%)]" />
      </div>

      <div className="container-page py-28 text-center sm:py-40">
        <h2
          id="cta-heading"
          className="mx-auto display text-[17vw] text-fg sm:text-8xl lg:text-[10rem]"
        >
          <RevealText text="Ready for the" />{" "}
          <span className="text-lime">
            <RevealText text="showdown?" delay={0.2} />
          </span>
        </h2>
        <Reveal delay={0.15}>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {copy[registrationStatus]}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Magnetic>
              <ButtonLink href="/register" size="lg" className="group">
                {registrationStatus === "open"
                  ? "Register Now"
                  : "Registrations Closed"}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                />
              </ButtonLink>
            </Magnetic>
            <ButtonLink href="/events" size="lg" variant="secondary">
              Explore Events
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
