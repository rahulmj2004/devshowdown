"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, Plus, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { fetchRegistration, submitRegistration } from "@/app/register/actions";
import { accentStyle } from "@/components/events/accent";
import { EventIcon } from "@/components/events/event-icon";
import { describe, Field, inputClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import type {
  CreateRegistrationResponse,
  RegistrationSummary,
} from "@/lib/registration/service";
import { cn, formatPaise } from "@/lib/utils";
import {
  CLIENT_KEY_PATTERN,
  createRegistrationSchema,
  isTeamEvent,
  REFERENCE_PATTERN,
  toFieldErrors,
  type RegistrationFieldErrors,
  type RegistrationFormValues,
} from "@/lib/validation/registration";
import type {
  Accent,
  EventIconKey,
  PaymentMode,
  PhoneFieldMode,
  RegistrationStatus,
  TeamRule,
} from "@/types";
import { Confirmation } from "./confirmation";
import { PaymentStep } from "./payment-step";
import { Stepper, type StepId } from "./stepper";

export interface FlowEvent {
  slug: string;
  title: string;
  tagline: string;
  accent: Accent;
  icon: EventIconKey;
  /** Accepting registrations right now. */
  open: boolean;
  team: TeamRule | null;
  /** What the server will charge for this entry. Display only. */
  feePaise: number;
  /** False while the organizers have not confirmed a fee. */
  feeConfirmed: boolean;
}

export interface FlowConfig {
  siteName: string;
  status: RegistrationStatus;
  phoneField: PhoneFieldMode;
  allowMultipleEvents: boolean;
  /** No database is connected: nothing is saved. */
  demo: boolean;
  paymentMode: PaymentMode;
  paymentUnavailableReason: string | null;
  /** Fees come from DEV_FEE_OVERRIDE_INR, not from confirmed prices. */
  testFees: boolean;
  emailConfigured: boolean;
  contact: { email: string | null; phone: string | null };
}

type FormStep = "events" | "details" | "review";
type Values = Omit<RegistrationFormValues, "clientKey">;

/* ------------------------------------------------------- saved progress */

const STORAGE_KEY = "devshowdown:registration";
const PLACEHOLDER_KEY = "0".repeat(64);

interface Access {
  reference: string;
  clientKey: string;
}

const storageListeners = new Set<() => void>();

function subscribeToStorage(onChange: () => void) {
  storageListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    storageListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Remembers which registration this browser is in the middle of, so a
 * refresh resumes at payment instead of starting a second registration. Only
 * the reference and the random browser key are kept, never personal details.
 */
function saveAccess(access: Access | null) {
  try {
    if (access) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the flow still works.
  }
  for (const listener of storageListeners) listener();
}

function parseAccess(raw: string | null): Access | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Access>;
    if (
      typeof value.reference === "string" &&
      REFERENCE_PATTERN.test(value.reference) &&
      typeof value.clientKey === "string" &&
      CLIENT_KEY_PATTERN.test(value.clientKey)
    ) {
      return { reference: value.reference, clientKey: value.clientKey };
    }
  } catch {
    // Fall through: treat unreadable data as nothing saved.
  }
  return null;
}

/** 32 random bytes, hex encoded. Identifies this submission to the server. */
function newClientKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/* --------------------------------------------------------------- helpers */

const fieldId = (path: string) => `reg-${path.replaceAll(".", "-")}`;

function stepForPath(path: string): FormStep {
  if (path === "eventSlugs") return "events";
  if (path === "agree" || path === "clientKey") return "review";
  return "details";
}

function describeTeam(team: TeamRule | null): string {
  if (team === null) return "Team size TBA";
  if (team.max === 1) return "Solo";
  return team.min === team.max
    ? `Team of ${team.max}`
    : `Team of ${team.min}–${team.max}`;
}

function describeFee(event: FlowEvent): string {
  if (event.feePaise > 0) return formatPaise(event.feePaise);
  return event.feeConfirmed ? "Free" : "No fee set";
}

/** Extra member rows a team event starts with (everyone but the registrant). */
const initialMembers = (team: TeamRule | null) =>
  isTeamEvent(team) ? Array<string>(Math.max(team.min - 1, 0)).fill("") : [];

const emptyValues = (events: FlowEvent[], preselected?: string): Values => {
  const slug = events.find((event) => event.open && event.slug === preselected);
  return {
    fullName: "",
    email: "",
    organization: "",
    phone: "",
    eventSlugs: slug ? [slug.slug] : [],
    teams: slug
      ? { [slug.slug]: { teamName: "", members: initialMembers(slug.team) } }
      : {},
    agree: false,
  };
};

/* ------------------------------------------------------------- the flow */

export function RegistrationFlow({
  events,
  config,
  defaultEventSlug,
}: {
  events: FlowEvent[];
  config: FlowConfig;
  defaultEventSlug?: string;
}) {
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const openEvents = useMemo(
    () => events.filter((event) => event.open),
    [events],
  );
  const schema = useMemo(
    () =>
      createRegistrationSchema({
        events: openEvents.map((event) => ({
          slug: event.slug,
          team: event.team,
        })),
        phone: config.phoneField,
        allowMultipleEvents: config.allowMultipleEvents,
      }),
    [openEvents, config.phoneField, config.allowMultipleEvents],
  );
  const accepting = config.status === "open" && openEvents.length > 0;

  const [values, setValues] = useState<Values>(() =>
    emptyValues(events, defaultEventSlug),
  );
  const [formStep, setFormStep] = useState<FormStep>("events");
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [honeypot, setHoneypot] = useState("");
  const [failure, setFailure] = useState<Exclude<
    CreateRegistrationResponse,
    { status: "created" | "invalid" }
  > | null>(null);
  const [registration, setRegistration] = useState<RegistrationSummary | null>(
    null,
  );
  // Reused if the same submission is sent twice; replaced once details change.
  const [clientKey, setClientKey] = useState<string | null>(null);
  // The credentials for `registration`. Held in memory as well as in
  // storage, so the flow still works where storage is blocked.
  const [access, setAccess] = useState<Access | null>(null);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const savedRaw = useSyncExternalStore(
    subscribeToStorage,
    readStorage,
    () => null,
  );
  const saved = useMemo(() => parseAccess(savedRaw), [savedRaw]);

  // After a refresh, pick the saved registration back up from the server.
  useEffect(() => {
    if (!saved || registration || restoreFailed) return;
    let cancelled = false;
    fetchRegistration(saved)
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setAccess(saved);
          setRegistration(found);
        } else {
          saveAccess(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRestoreFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [saved, registration, restoreFailed]);

  const step: StepId = registration
    ? registration.status === "confirmed"
      ? "done"
      : "payment"
    : formStep;

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land where the content changed. Skipped on first render.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    containerRef.current
      ?.querySelector<HTMLElement>("[data-step-heading]")
      ?.focus({ preventScroll: true });
    containerRef.current?.scrollIntoView?.({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [step, reduceMotion]);

  const selected = openEvents.filter((event) =>
    values.eventSlugs.includes(event.slug),
  );
  const totalPaise = selected.reduce((sum, event) => sum + event.feePaise, 0);
  const paymentBlocked =
    totalPaise > 0 && config.paymentMode === "unconfigured";

  /* ------------------------------------------------------------ editing */

  const edit = (change: (current: Values) => Values, clear?: string) => {
    setValues(change);
    setClientKey(null);
    setFailure(null);
    if (clear) {
      setErrors((current) => {
        if (!(clear in current)) return current;
        const next = { ...current };
        delete next[clear];
        return next;
      });
    }
  };

  const setField = <K extends "fullName" | "email" | "organization" | "phone">(
    field: K,
    value: string,
  ) => edit((current) => ({ ...current, [field]: value }), field);

  const toggleEvent = (event: FlowEvent, checked: boolean) =>
    edit((current) => {
      const eventSlugs = config.allowMultipleEvents
        ? checked
          ? [...current.eventSlugs, event.slug]
          : current.eventSlugs.filter((slug) => slug !== event.slug)
        : checked
          ? [event.slug]
          : [];
      return {
        ...current,
        eventSlugs,
        teams: {
          ...current.teams,
          [event.slug]: current.teams[event.slug] ?? {
            teamName: "",
            members: initialMembers(event.team),
          },
        },
      };
    }, "eventSlugs");

  const setTeam = (
    slug: string,
    change: (team: Values["teams"][string]) => Values["teams"][string],
    clear: string,
  ) =>
    edit(
      (current) => ({
        ...current,
        teams: {
          ...current.teams,
          [slug]: change(current.teams[slug] ?? { teamName: "", members: [] }),
        },
      }),
      clear,
    );

  /* --------------------------------------------------------- validation */

  /** Errors for the steps up to and including `upTo`. */
  const validate = (upTo: FormStep): RegistrationFieldErrors => {
    const order: FormStep[] = ["events", "details", "review"];
    const inScope = new Set(order.slice(0, order.indexOf(upTo) + 1));
    const parsed = schema.safeParse({
      ...values,
      // Only the chosen events' team details are submitted.
      teams: Object.fromEntries(
        values.eventSlugs.map((slug) => [slug, values.teams[slug] ?? {}]),
      ),
      agree: upTo === "review" ? values.agree : true,
      clientKey: PLACEHOLDER_KEY,
    });
    if (parsed.success) return {};
    return Object.fromEntries(
      Object.entries(toFieldErrors(parsed.error)).filter(([path]) =>
        inScope.has(stepForPath(path)),
      ),
    );
  };

  const showErrors = (found: RegistrationFieldErrors) => {
    setErrors(found);
    const first = Object.keys(found)[0];
    if (!first) return;
    const target = stepForPath(first);
    setFormStep(target);
    // Wait for the step to render before focusing the field inside it.
    requestAnimationFrame(() => {
      const id =
        first === "eventSlugs"
          ? fieldId(`event.${openEvents[0]?.slug ?? ""}`)
          : first.endsWith(".members")
            ? fieldId(`${first}.0`)
            : fieldId(first);
      document.getElementById(id)?.focus();
    });
  };

  const validateField = (path: string) => {
    const message = validate("review")[path];
    setErrors((current) => {
      const next = { ...current };
      if (message) next[path] = message;
      else delete next[path];
      return next;
    });
  };

  const goTo = (target: FormStep, from: FormStep) => {
    const found = validate(from);
    if (Object.keys(found).length > 0) return showErrors(found);
    setErrors({});
    setFormStep(target);
  };

  /* ------------------------------------------------------------- submit */

  const submit = () => {
    if (pending || !accepting || paymentBlocked) return;
    setFailure(null);
    const found = validate("review");
    if (Object.keys(found).length > 0) return showErrors(found);
    setErrors({});

    const key = clientKey ?? newClientKey();
    setClientKey(key);

    startTransition(async () => {
      try {
        const response = await submitRegistration(
          {
            ...values,
            teams: Object.fromEntries(
              values.eventSlugs.map((slug) => [slug, values.teams[slug] ?? {}]),
            ),
            clientKey: key,
          },
          honeypot,
        );
        if (response.status === "created") {
          const created = {
            reference: response.registration.reference,
            clientKey: key,
          };
          saveAccess(created);
          setAccess(created);
          setRegistration(response.registration);
          if (response.registration.status === "confirmed") {
            toast({
              title: response.registration.demo
                ? "Demo run complete"
                : "Registration confirmed",
              tone: "success",
            });
          } else {
            toast({
              title: "Details saved",
              description: "Complete the payment to confirm your place.",
            });
          }
        } else if (response.status === "invalid") {
          showErrors(response.fieldErrors);
        } else {
          setFailure(response);
        }
      } catch {
        // Network failure or server error: never assume it was saved.
        setFailure({ status: "error" });
      }
    });
  };

  const startOver = useCallback((keepValues: boolean) => {
    saveAccess(null);
    setAccess(null);
    setRegistration(null);
    setClientKey(null);
    setFailure(null);
    setRestoreFailed(false);
    setErrors({});
    setFormStep("events");
    if (!keepValues) setValues(emptyValues([], undefined));
  }, []);

  /* ------------------------------------------------------------- render */

  if (saved && !registration && !restoreFailed) {
    return <RegistrationFlowSkeleton label="Loading your registration…" />;
  }

  const fieldError = (path: string) => errors[path];

  let body: ReactNode;
  if (registration && step === "done") {
    body = (
      <Confirmation
        registration={registration}
        emailConfigured={config.emailConfigured}
        contact={config.contact}
        onRegisterAnother={() => startOver(false)}
      />
    );
  } else if (registration && access) {
    body = (
      <PaymentStep
        registration={registration}
        access={access}
        siteName={config.siteName}
        paymentMode={config.paymentMode}
        onUpdate={setRegistration}
        onStartOver={() => startOver(true)}
      />
    );
  } else if (formStep === "events") {
    body = (
      <fieldset disabled={!accepting} className="min-w-0">
        <legend className="contents">
          <h2
            tabIndex={-1}
            data-step-heading=""
            className="display text-3xl text-fg outline-none sm:text-4xl"
          >
            Choose your competition
          </h2>
        </legend>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {config.allowMultipleEvents
            ? "Pick one or more. You can enter several competitions in a single registration."
            : "Pick the competition you want to enter."}
        </p>

        <ul className="mt-6 grid gap-3">
          {events.map((event) => {
            const checked = values.eventSlugs.includes(event.slug);
            const id = fieldId(`event.${event.slug}`);
            return (
              <li key={event.slug}>
                <label
                  htmlFor={id}
                  style={accentStyle(event.accent)}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-4 border bg-bg px-4 py-4 transition-[border-color,background-color] duration-200 sm:px-5",
                    checked
                      ? "border-(--accent) bg-(--accent)/[0.06]"
                      : "border-line-strong hover:border-(--accent)/60",
                    !event.open && "cursor-not-allowed opacity-55",
                    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lime",
                  )}
                >
                  <input
                    id={id}
                    type={config.allowMultipleEvents ? "checkbox" : "radio"}
                    name="eventSlugs"
                    value={event.slug}
                    checked={checked}
                    disabled={!event.open}
                    onChange={(e) => toggleEvent(event, e.target.checked)}
                    aria-labelledby={`${id}-title`}
                    aria-describedby={`${id}-meta`}
                    aria-invalid={fieldError("eventSlugs") ? true : undefined}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center border transition-colors duration-200",
                      !config.allowMultipleEvents && "rounded-full",
                      checked
                        ? "border-(--accent) bg-(--accent)"
                        : "border-line-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 bg-[#060608] transition-transform duration-200",
                        !config.allowMultipleEvents && "rounded-full",
                        checked ? "scale-100" : "scale-0",
                      )}
                    />
                  </span>
                  <EventIcon
                    icon={event.icon}
                    className="hidden size-5 shrink-0 text-(--accent) sm:block"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      id={`${id}-title`}
                      className="block display text-2xl text-fg"
                    >
                      {event.title}
                    </span>
                    <span
                      id={`${id}-meta`}
                      className="mt-1 block font-mono text-[11px] text-subtle"
                    >
                      {event.open
                        ? `${describeTeam(event.team)} · ${describeFee(event)}`
                        : "Registration closed"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {fieldError("eventSlugs") && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {fieldError("eventSlugs")}
          </p>
        )}

        <div className="mt-8">
          <Button
            size="lg"
            className="group w-full sm:w-auto"
            onClick={() => goTo("details", "events")}
          >
            {accepting
              ? "Continue"
              : config.status === "closed"
                ? "Registration closed"
                : "Registration not open yet"}
            {accepting && (
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            )}
          </Button>
        </div>
      </fieldset>
    );
  } else if (formStep === "details") {
    body = (
      <div>
        <h2
          tabIndex={-1}
          data-step-heading=""
          className="display text-3xl text-fg outline-none sm:text-4xl"
        >
          Your details
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Only what the organizers need to run the event.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field
            id={fieldId("fullName")}
            label="Full name"
            error={fieldError("fullName")}
          >
            <input
              id={fieldId("fullName")}
              name="fullName"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={values.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              onBlur={() => validateField("fullName")}
              className={inputClasses}
              {...describe(fieldId("fullName"), fieldError("fullName"))}
            />
          </Field>

          <Field
            id={fieldId("email")}
            label="Email address"
            error={fieldError("email")}
          >
            <input
              id={fieldId("email")}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              onBlur={() => validateField("email")}
              className={inputClasses}
              {...describe(fieldId("email"), fieldError("email"))}
            />
          </Field>

          <Field
            id={fieldId("organization")}
            label="College or organization"
            error={fieldError("organization")}
            className={
              config.phoneField === "hidden" ? "sm:col-span-2" : undefined
            }
          >
            <input
              id={fieldId("organization")}
              name="organization"
              type="text"
              autoComplete="organization"
              required
              maxLength={120}
              value={values.organization}
              onChange={(e) => setField("organization", e.target.value)}
              onBlur={() => validateField("organization")}
              className={inputClasses}
              {...describe(fieldId("organization"), fieldError("organization"))}
            />
          </Field>

          {config.phoneField !== "hidden" && (
            <Field
              id={fieldId("phone")}
              label="Phone number"
              optional={config.phoneField === "optional"}
              error={fieldError("phone")}
            >
              <input
                id={fieldId("phone")}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required={config.phoneField === "required"}
                maxLength={20}
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
                onBlur={() => validateField("phone")}
                className={inputClasses}
                {...describe(fieldId("phone"), fieldError("phone"))}
              />
            </Field>
          )}
        </div>

        {selected
          .filter((event) => event.team === null || isTeamEvent(event.team))
          .map((event) => {
            const team = values.teams[event.slug] ?? {
              teamName: "",
              members: [],
            };
            const rule = event.team;
            const teamEvent = isTeamEvent(rule);
            const namePath = `teams.${event.slug}.teamName`;
            const membersPath = `teams.${event.slug}.members`;
            const hint = teamEvent
              ? undefined
              : "Only if you are entering as a team.";
            return (
              <fieldset
                key={event.slug}
                style={accentStyle(event.accent)}
                className="mt-8 min-w-0 border-l-2 border-(--accent) pl-5"
              >
                <legend className="eyebrow text-(--accent)">
                  {event.title} · {teamEvent ? describeTeam(rule) : "team"}
                </legend>
                <div className="mt-3 grid gap-5 sm:grid-cols-2">
                  <Field
                    id={fieldId(namePath)}
                    label={`Team name for ${event.title}`}
                    optional={!teamEvent}
                    hint={hint}
                    error={fieldError(namePath)}
                    className="sm:col-span-2"
                  >
                    <input
                      id={fieldId(namePath)}
                      type="text"
                      maxLength={60}
                      required={teamEvent}
                      value={team.teamName}
                      onChange={(e) =>
                        setTeam(
                          event.slug,
                          (current) => ({
                            ...current,
                            teamName: e.target.value,
                          }),
                          namePath,
                        )
                      }
                      onBlur={() => validateField(namePath)}
                      className={inputClasses}
                      {...describe(
                        fieldId(namePath),
                        fieldError(namePath),
                        hint,
                      )}
                    />
                  </Field>

                  {teamEvent &&
                    team.members.map((member, index) => {
                      const path = `${membersPath}.${index}`;
                      const removable = team.members.length > rule.min - 1;
                      return (
                        <Field
                          key={index}
                          id={fieldId(path)}
                          label={`Team member ${index + 2} name`}
                          error={fieldError(path)}
                        >
                          <div className="flex gap-2">
                            <input
                              id={fieldId(path)}
                              type="text"
                              autoComplete="off"
                              maxLength={100}
                              required
                              value={member}
                              onChange={(e) =>
                                setTeam(
                                  event.slug,
                                  (current) => ({
                                    ...current,
                                    members: current.members.map(
                                      (value, position) =>
                                        position === index
                                          ? e.target.value
                                          : value,
                                    ),
                                  }),
                                  path,
                                )
                              }
                              onBlur={() => validateField(path)}
                              className={inputClasses}
                              {...describe(fieldId(path), fieldError(path))}
                            />
                            {removable && (
                              <button
                                type="button"
                                onClick={() =>
                                  setTeam(
                                    event.slug,
                                    (current) => ({
                                      ...current,
                                      members: current.members.filter(
                                        (_, position) => position !== index,
                                      ),
                                    }),
                                    membersPath,
                                  )
                                }
                                className="flex size-11 shrink-0 items-center justify-center rounded-[3px] border border-line-strong text-subtle transition-colors hover:border-danger hover:text-danger"
                              >
                                <span className="sr-only">
                                  Remove team member {index + 2}
                                </span>
                                <X aria-hidden="true" className="size-4" />
                              </button>
                            )}
                          </div>
                        </Field>
                      );
                    })}
                </div>

                {teamEvent && (
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    {team.members.length < rule.max - 1 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setTeam(
                            event.slug,
                            (current) => ({
                              ...current,
                              members: [...current.members, ""],
                            }),
                            membersPath,
                          )
                        }
                      >
                        <Plus aria-hidden="true" className="size-3.5" />
                        Add team member
                      </Button>
                    )}
                    <p className="font-mono text-[11px] text-subtle">
                      You plus {team.members.length} = {team.members.length + 1}{" "}
                      of {rule.max}
                    </p>
                  </div>
                )}
                {fieldError(membersPath) && (
                  <p role="alert" className="mt-3 text-xs text-danger">
                    {fieldError(membersPath)}
                  </p>
                )}
              </fieldset>
            );
          })}

        <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setFormStep("events")}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Button>
          <Button
            size="lg"
            className="group"
            onClick={() => goTo("review", "details")}
          >
            Review
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            />
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <form
        noValidate
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2
          tabIndex={-1}
          data-step-heading=""
          className="display text-3xl text-fg outline-none sm:text-4xl"
        >
          Review and confirm
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Check everything before you{" "}
          {totalPaise > 0 ? "continue to payment" : "confirm"}.
        </p>

        <dl className="mt-6 divide-y divide-line border border-line-strong bg-bg text-sm">
          {[
            ["Name", values.fullName.trim()],
            ["Email", values.email.trim().toLowerCase()],
            ["College or organization", values.organization.trim()],
            ...(config.phoneField !== "hidden" && values.phone.trim()
              ? [["Phone", values.phone.trim()]]
              : []),
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between gap-4 px-5 py-3"
            >
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0 text-right break-words text-fg">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-7 eyebrow text-subtle">Competitions and fees</h3>
        <table className="mt-3 w-full border border-line-strong bg-bg text-sm">
          <caption className="sr-only">Fee breakdown</caption>
          <tbody className="divide-y divide-line">
            {selected.map((event) => {
              const team = values.teams[event.slug];
              const members = isTeamEvent(event.team)
                ? (team?.members ?? []).map((member) => member.trim())
                : [];
              return (
                <tr key={event.slug}>
                  <th
                    scope="row"
                    className="px-5 py-3 text-left font-normal text-fg"
                  >
                    {event.title}
                    {team?.teamName.trim() && (
                      <span className="block text-xs text-muted">
                        Team {team.teamName.trim()}
                        {members.length > 0 && ` · with ${members.join(", ")}`}
                      </span>
                    )}
                  </th>
                  <td className="px-5 py-3 text-right whitespace-nowrap text-muted">
                    {describeFee(event)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong">
              <th
                scope="row"
                className="px-5 py-4 text-left font-medium text-fg"
              >
                Total payable
              </th>
              <td className="px-5 py-4 text-right display text-3xl text-lime">
                {formatPaise(totalPaise)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-subtle">
          {totalPaise === 0
            ? "// nothing is payable online for this registration"
            : config.paymentMode === "mock"
              ? "// mock gateway: a simulated payment, no money moves"
              : config.paymentMode === "upi"
                ? "// paid by UPI on the next step, then checked by a coordinator"
                : "// paid securely through Razorpay on the next step"}
        </p>

        <div className="mt-6 space-y-3 empty:hidden">
          {config.testFees && totalPaise > 0 && (
            <Notice tone="warn" title="Development fee override is active">
              These amounts are test values from DEV_FEE_OVERRIDE_INR, not
              confirmed registration fees.
            </Notice>
          )}
          {config.demo && (
            <Notice tone="warn" title="Demo mode: submissions are not saved">
              No registration database is connected to this site yet. You can
              complete the flow, but nothing you enter is stored and it does not
              register you for the event.
            </Notice>
          )}
          {paymentBlocked && (
            <Notice tone="danger" title="Online payment is not configured">
              {config.paymentUnavailableReason ??
                "Payment has not been set up for this site yet."}{" "}
              Registrations with a fee cannot be completed until it is.
            </Notice>
          )}
        </div>

        {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] size-px overflow-hidden"
        >
          <label htmlFor="reg-website">Website</label>
          <input
            id="reg-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-start gap-3">
            <input
              id={fieldId("agree")}
              name="agree"
              type="checkbox"
              required
              checked={values.agree}
              disabled={pending}
              onChange={(e) =>
                edit(
                  (current) => ({ ...current, agree: e.target.checked }),
                  "agree",
                )
              }
              className="mt-0.5 size-4 shrink-0 accent-lime disabled:opacity-60"
              {...describe(fieldId("agree"), fieldError("agree"))}
            />
            <label
              htmlFor={fieldId("agree")}
              className="text-sm leading-relaxed text-muted"
            >
              I agree to the{" "}
              <Link
                href="/rules"
                className="rounded-sm text-fg underline underline-offset-4 hover:text-lime"
              >
                event rules
              </Link>{" "}
              and the{" "}
              <Link
                href="/privacy"
                className="rounded-sm text-fg underline underline-offset-4 hover:text-lime"
              >
                privacy notice
              </Link>
              .
            </label>
          </div>
          {fieldError("agree") && (
            <p
              id={`${fieldId("agree")}-error`}
              className="mt-2 text-xs text-danger"
            >
              {fieldError("agree")}
            </p>
          )}
        </div>

        <div aria-live="polite" className="mt-5 empty:hidden">
          {failure?.status === "duplicate" && (
            <Notice tone="warn" title="You're already registered">
              This email address already has a confirmed entry for{" "}
              {failure.eventTitles.join(", ")}. No duplicate entry was created.
            </Notice>
          )}
          {failure?.status === "closed" && (
            <Notice tone="warn" title="Registration is not open">
              Nothing was submitted. Please check back when registration opens.
            </Notice>
          )}
          {failure?.status === "payments_unavailable" && (
            <Notice tone="warn" title="Not submitted: payment is unavailable">
              {failure.reason} Nothing was saved and nothing was charged.
            </Notice>
          )}
          {failure?.status === "error" && (
            <Notice tone="danger" title="Your registration was not saved">
              Something went wrong on our side. Please try again in a moment;
              submitting again will not create a duplicate.
            </Notice>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setFormStep("details")}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Button>
          <Button type="submit" size="lg" disabled={pending || paymentBlocked}>
            {pending && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            )}
            {pending
              ? "Submitting…"
              : totalPaise > 0
                ? `Continue to payment · ${formatPaise(totalPaise)}`
                : "Confirm registration"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div ref={containerRef} className="scroll-mt-24">
      <Stepper
        current={step}
        skipPayment={
          registration ? registration.amountPaise === 0 : totalPaise === 0
        }
      />

      {restoreFailed && !registration && (
        <Notice
          tone="warn"
          title="Your saved registration could not be loaded"
          className="mt-6"
        >
          Check your connection.{" "}
          <button
            type="button"
            className="rounded-sm text-fg underline underline-offset-4 hover:text-lime"
            onClick={() => setRestoreFailed(false)}
          >
            Try again
          </button>{" "}
          or{" "}
          <button
            type="button"
            className="rounded-sm text-fg underline underline-offset-4 hover:text-lime"
            onClick={() => startOver(true)}
          >
            start a new registration
          </button>
          .
        </Notice>
      )}

      {/* Keyed so each step fades up as it mounts. There is no exit phase to
          wait for, so the next step is usable even if animation never runs.
          Reduced motion only shortens the transition, so the markup is the
          same on the server and in the browser. */}
      <motion.div
        key={step}
        className="relative mt-8"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.45,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {body}
      </motion.div>
    </div>
  );
}

export function RegistrationFlowSkeleton({
  label = "Loading registration…",
}: {
  label?: string;
}) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-0.5 bg-line-strong" />
        ))}
      </div>
      <div className="mt-10 h-9 w-64 max-w-full skeleton" />
      <div className="mt-4 h-4 w-80 max-w-full skeleton" />
      <div className="mt-7 space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-[4.5rem] skeleton" />
        ))}
      </div>
    </div>
  );
}
