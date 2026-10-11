import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { faqs } from "@/config/site";

/**
 * FAQ accordion built on native <details>. It is keyboard- and screen-reader
 * accessible by default and needs no client JavaScript; the shared `name`
 * makes the items mutually exclusive in supporting browsers.
 */
export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="border-t border-line"
    >
      <div className="container-page grid gap-12 py-24 sm:py-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="faq-heading"
            index="08"
            eyebrow="FAQ"
            title="Questions, answered"
            description="Some details are still being finalized. Anything unconfirmed is labelled, not guessed."
          />
        </div>

        <Reveal delay={0.08}>
          <div className="border-t border-line-strong">
            {faqs.map((faq, index) => (
              <details
                key={faq.question}
                name="faq"
                className="group border-b border-line"
              >
                <summary className="flex cursor-pointer list-none items-center gap-5 rounded-sm py-5 text-left text-base font-medium text-fg transition-colors hover:text-lime sm:text-lg [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-subtle"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{faq.question}</span>
                  <Plus
                    aria-hidden="true"
                    className="size-5 shrink-0 text-subtle transition-transform duration-300 ease-out group-open:rotate-45 group-open:text-lime"
                  />
                </summary>
                <div className="pr-9 pb-6 pl-9 text-sm leading-relaxed text-muted sm:pl-10">
                  {faq.awaitingConfirmation && (
                    <Badge tone="warn" className="mb-3">
                      Awaiting confirmation
                    </Badge>
                  )}
                  <p>{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
