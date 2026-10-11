import { ProgressLine } from "@/components/motion/progress-line";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/config/site";
import type { ScheduleItem } from "@/types";

const kinds: Record<
  NonNullable<ScheduleItem["kind"]>,
  { label: string; tone: BadgeTone }
> = {
  registration: { label: "Registration", tone: "cyan" },
  ceremony: { label: "Ceremony", tone: "violet" },
  round: { label: "Competition", tone: "success" },
  break: { label: "Break", tone: "neutral" },
  results: { label: "Results", tone: "warn" },
};

/**
 * Event timeline, read from `siteConfig.schedule`. Nothing is listed until the
 * organizers confirm it: with an empty schedule this renders an explicit
 * "to be announced" state, not placeholder times.
 */
export function ScheduleSection() {
  const { schedule, details } = siteConfig;
  const confirmed = schedule.length > 0;
  // A clock time contains a digit followed by ":" or am/pm; session labels do not.
  const timed = schedule.some((day) =>
    day.items.some((item) => /\d\s*(:|am|pm)/i.test(item.time)),
  );

  return (
    <section
      id="schedule"
      aria-labelledby="schedule-heading"
      className="border-t border-line"
    >
      <div className="container-page grid gap-14 py-24 sm:py-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <SectionHeading
            id="schedule-heading"
            index="04"
            eyebrow="Schedule"
            title="Run of show"
            description={
              timed
                ? `All times are shown in ${details.timezoneLabel}.`
                : confirmed
                  ? "The order of the day. Exact timings will be announced by the organizers."
                  : "The timeline will be published here as soon as each slot is confirmed."
            }
          />
          <dl className="mt-8 grid max-w-sm grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="eyebrow text-subtle">Dates</dt>
              <dd className="mt-1.5 text-fg">
                {details.dates ?? (
                  <span className="font-mono text-subtle">TBA</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-subtle">Timezone</dt>
              <dd className="mt-1.5 text-fg">{details.timezoneLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="relative pl-8">
          <ProgressLine
            orientation="vertical"
            className="absolute top-1 left-0 h-[calc(100%-0.5rem)] w-px"
          />

          {confirmed ? (
            <div className="space-y-12">
              {schedule.map((day) => (
                <div key={day.label}>
                  <h3 className="display text-3xl text-fg">{day.label}</h3>
                  <ol className="mt-6 space-y-7">
                    {day.items.map((item, index) => {
                      const kind = item.kind ? kinds[item.kind] : null;
                      return (
                        <li
                          key={`${item.time}-${item.title}`}
                          className="relative"
                        >
                          <span
                            aria-hidden="true"
                            className="absolute top-2 -left-[calc(2rem+4.5px)] size-2.5 bg-lime"
                          />
                          <Reveal delay={Math.min(index, 4) * 0.05}>
                            <p className="font-mono text-xs text-lime">
                              {item.time}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              <p className="text-lg font-medium text-fg">
                                {item.title}
                              </p>
                              {kind && (
                                <Badge tone={kind.tone}>{kind.label}</Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
                                {item.description}
                              </p>
                            )}
                          </Reveal>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <Reveal>
              <span
                aria-hidden="true"
                className="absolute top-2 -left-[4.5px] size-2.5 bg-lime"
              />
              <p className="display text-3xl text-fg sm:text-4xl">
                Schedule to be announced
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                Registration, opening, competition rounds, breaks and results
                will each appear on this timeline once the organizers confirm
                the time.
              </p>
              {/* Unlabelled, striped slots: clearly empty, not invented. */}
              <ul aria-hidden="true" className="mt-10 space-y-4">
                {[72, 56, 64, 44].map((width, index) => (
                  <li key={index} className="relative flex items-center gap-4">
                    <span className="absolute -left-[calc(2rem+3.5px)] size-2 border border-line-strong bg-bg" />
                    <span className="font-mono text-xs text-subtle/60">
                      --:--
                    </span>
                    <span
                      className="h-9 border border-dashed border-line-strong bg-[repeating-linear-gradient(135deg,transparent_0_8px,#ffffff08_8px_9px)]"
                      style={{ width: `${width}%` }}
                    />
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
