import { ProgressLine } from "@/components/motion/progress-line";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  {
    title: "Register",
    text: "Form a team of 3 and register through the form. The entry fee is ₹150 per team.",
  },
  {
    title: "Choose your challenge",
    text: "Debugging, Speed Typing and Blind Coding run in the morning. Each team member takes on one of them.",
  },
  {
    title: "Compete",
    text: "Every member scores points for the team. The top 5 teams advance to the Treasure Hunt and the Coding round.",
  },
  {
    title: "Results",
    text: "The top 2 teams in the Treasure Hunt take home the prize money.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="container-page py-24 sm:py-32"
    >
      <SectionHeading
        id="how-heading"
        index="03"
        eyebrow="How it works"
        title="From sign-up to scoreboard"
      />

      <div className="relative mt-16">
        {/* The journey line fills as you scroll: across on desktop, down on mobile. */}
        <ProgressLine
          orientation="horizontal"
          className="absolute top-0 hidden h-px w-full lg:block"
        />
        <ProgressLine
          orientation="vertical"
          className="absolute top-0 left-0 h-full w-px lg:hidden"
        />

        <ol className="grid gap-12 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, index) => (
            <li key={step.title} className="relative pl-8 lg:pt-10 lg:pl-0">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[4.5px] size-2.5 bg-lime lg:-top-[4.5px] lg:left-0"
              />
              <Reveal delay={index * 0.08}>
                <p
                  aria-hidden="true"
                  className="display text-7xl text-outline [--outline-color:#ffffff40] sm:text-8xl"
                >
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-4 display text-3xl text-fg">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
                  {step.text}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
