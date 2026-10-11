import { ArrowUp, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Tba } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

const explore = [
  { label: "Events", href: "/events" },
  { label: "Register", href: "/register" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Schedule", href: "/#schedule" },
  { label: "FAQ", href: "/#faq" },
] as const;

const legal = [
  { label: "Rules", href: "/rules" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refunds", href: "/refunds" },
] as const;

/* Underline wipes in from the left on hover or focus. */
const linkClass =
  "relative inline-block rounded-sm text-sm text-muted transition-colors duration-200 hover:text-fg after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-lime after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100";

function Column({
  title,
  id,
  links,
}: {
  title: string;
  id: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="eyebrow text-subtle">
        {title}
      </h2>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={linkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const { contact, socials, details } = siteConfig;

  return (
    <footer className="relative overflow-hidden border-t border-line bg-bg-soft">
      <div className="container-page grid gap-12 pt-16 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <p className="display text-4xl text-fg sm:text-5xl">
            {siteConfig.headline.join(" ")}
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            {siteConfig.tagline}
          </p>
          <a
            href="#top"
            className="group mt-8 inline-flex items-center gap-2 eyebrow text-subtle transition-colors hover:text-lime"
          >
            <span className="flex size-8 items-center justify-center rounded-[3px] border border-line-strong transition-colors group-hover:border-lime">
              <ArrowUp
                aria-hidden="true"
                className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5"
              />
            </span>
            Back to top
          </a>
        </div>

        <Column title="Explore" id="footer-explore" links={explore} />
        <Column title="Policies" id="footer-legal" links={legal} />

        <div>
          <h2 className="eyebrow text-subtle">Organizers</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="sr-only">Organized by</dt>
              <dd className="text-fg">
                {details.organizer ?? <Tba label="Organizer to be announced" />}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Email</dt>
              <dd>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className={linkClass}>
                    {contact.email}
                  </a>
                ) : (
                  <Tba label="Email to be announced" />
                )}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Phone</dt>
              <dd>
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className={linkClass}>
                    {contact.phone}
                  </a>
                ) : (
                  <Tba label="Phone to be announced" />
                )}
              </dd>
            </div>
          </dl>

          <h2 className="mt-8 eyebrow text-subtle">Follow</h2>
          {socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {socials.map((social) => (
                <li key={social.href}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1.5 rounded-[3px] border border-line-strong px-3 py-1.5 text-sm text-muted transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-lime hover:text-lime"
                  >
                    {social.label}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4">
              <Tba label="Social links to be announced" />
            </p>
          )}
        </div>
      </div>

      {/* Oversized hollow wordmark, cropped by the footer's bottom edge. */}
      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.14em] text-center display text-[16.9vw] leading-[0.8] whitespace-nowrap text-outline select-none [--outline-color:#ffffff24]"
      >
        DevShowdown
      </p>

      <div className="relative border-t border-line bg-bg-soft">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>{siteConfig.name}. Event details are subject to confirmation.</p>
          <Link
            href="/admin"
            className="rounded-sm transition-colors hover:text-fg"
          >
            Organizer sign-in
          </Link>
        </div>
      </div>
    </footer>
  );
}
