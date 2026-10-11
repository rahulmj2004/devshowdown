"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import {
  createResultAction,
  signInAction,
  updateSettingsAction,
  type ActionState,
} from "@/app/admin/actions";
import { Field, inputClasses } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RegistrationStatus } from "@/types";

function Feedback({ state }: { state: ActionState }) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "min-h-5 text-sm",
        state?.ok ? "text-success" : "text-danger",
      )}
    >
      {state?.message}
    </p>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: string;
}) {
  return (
    <Button type="submit" disabled={pending}>
      {pending && (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      )}
      {children}
    </Button>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <form action={action} className="space-y-5">
      <Field id="admin-email" label="Email address">
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputClasses}
        />
      </Field>
      <Field id="admin-password" label="Password">
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClasses}
        />
      </Field>
      <Feedback state={state} />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}

export interface SettingsFormValues {
  registrationStatus: RegistrationStatus;
  announcementLabel: string;
  announcementText: string;
}

export function SettingsForm({
  values,
  disabled = false,
}: {
  values: SettingsFormValues;
  /** Prototype mode: render the controls but never submit. */
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(updateSettingsAction, null);
  return (
    <form action={disabled ? undefined : action}>
      <fieldset
        disabled={disabled || pending}
        className="grid gap-5 sm:grid-cols-2"
      >
        <legend className="sr-only">Site settings</legend>
        <Field id="set-status" label="Registration availability">
          <select
            id="set-status"
            name="registration_status"
            defaultValue={values.registrationStatus}
            className={inputClasses}
          >
            <option value="not_open">Not open yet</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </Field>
        <Field id="set-label" label="Announcement badge">
          <input
            id="set-label"
            name="announcement_label"
            type="text"
            maxLength={40}
            required
            defaultValue={values.announcementLabel}
            className={inputClasses}
          />
        </Field>
        <Field
          id="set-text"
          label="Announcement text"
          className="sm:col-span-2"
        >
          <input
            id="set-text"
            name="announcement_text"
            type="text"
            maxLength={160}
            required
            defaultValue={values.announcementText}
            className={inputClasses}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <SubmitButton pending={pending}>Save settings</SubmitButton>
          <Feedback state={state} />
        </div>
      </fieldset>
    </form>
  );
}

export function ResultForm({
  events,
  disabled = false,
}: {
  events: { slug: string; title: string }[];
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(createResultAction, null);
  return (
    <form action={disabled ? undefined : action}>
      <fieldset
        disabled={disabled || pending}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <legend className="sr-only">Add a result</legend>
        <Field id="res-event" label="Event">
          <select
            id="res-event"
            name="event_slug"
            required
            defaultValue=""
            className={inputClasses}
          >
            <option value="" disabled>
              Select an event
            </option>
            {events.map((event) => (
              <option key={event.slug} value={event.slug}>
                {event.title}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="res-name"
          label="Display name"
          hint="Shown publicly. Never an email or phone."
        >
          <input
            id="res-name"
            name="display_name"
            type="text"
            maxLength={80}
            required
            aria-describedby="res-name-hint"
            className={inputClasses}
          />
        </Field>
        <Field id="res-score" label="Score">
          <input
            id="res-score"
            name="score"
            type="number"
            step="any"
            required
            className={inputClasses}
          />
        </Field>
        <Field id="res-time" label="Time in seconds" optional>
          <input
            id="res-time"
            name="time_seconds"
            type="number"
            step="any"
            min={0}
            className={inputClasses}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2.5 text-sm text-muted">
            <input
              type="checkbox"
              name="published"
              className="size-4 accent-violet"
            />
            Publish to the leaderboard immediately
          </label>
          <SubmitButton pending={pending}>Add result</SubmitButton>
          <Feedback state={state} />
        </div>
      </fieldset>
    </form>
  );
}
