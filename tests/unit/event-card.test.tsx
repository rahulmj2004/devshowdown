import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventCard } from "@/components/events/event-card";
import { events } from "@/config/events";

const event = events[0];

describe("EventCard", () => {
  it("shows the event and links to its details page", () => {
    render(<EventCard event={event} registrationStatus="not_open" />);
    expect(
      screen.getByRole("heading", { name: event.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(event.tagline)).toBeInTheDocument();
    expect(screen.getByText(event.summary)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `Learn more about ${event.title}` }),
    ).toHaveAttribute("href", `/events/${event.slug}`);
  });

  it("does not offer registration before it opens", () => {
    render(<EventCard event={event} registrationStatus="not_open" />);
    expect(screen.queryByRole("link", { name: /register/i })).toBeNull();
    expect(screen.getByText("Registration not open yet")).toBeInTheDocument();
  });

  it("links to the pre-filled registration flow once open", () => {
    render(<EventCard event={event} registrationStatus="open" />);
    expect(
      screen.getByRole("link", { name: `Register for ${event.title}` }),
    ).toHaveAttribute("href", `/register?event=${event.slug}`);
  });

  it("marks unconfirmed details as TBA instead of inventing them", () => {
    render(<EventCard event={event} registrationStatus="not_open" />);
    expect(screen.getAllByText("TBA")).toHaveLength(3);
  });

  it("shows confirmed details when configured", () => {
    render(
      <EventCard
        event={{ ...event, format: "Two rounds", teamSize: "Solo" }}
        registrationStatus="not_open"
      />,
    );
    expect(screen.getByText("Two rounds")).toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getAllByText("TBA")).toHaveLength(1);
  });

  it("shows an entry fee only once the organizers have confirmed one", () => {
    const { rerender } = render(
      <EventCard event={event} registrationStatus="not_open" />,
    );
    expect(screen.queryByText("Entry fee")).toBeNull();

    rerender(
      <EventCard
        event={{ ...event, fee: 100 }}
        registrationStatus="not_open"
      />,
    );
    expect(screen.getByText("Entry fee")).toBeInTheDocument();
    expect(screen.getByText("₹100")).toBeInTheDocument();
  });
});

describe("event configuration", () => {
  it("lists the five competitions without inventing their details", () => {
    expect(events.map((item) => item.title)).toEqual([
      "Debugging",
      "Blind Coding",
      "Treasure Hunt",
      "Speed Typing",
      "Coding",
    ]);
    for (const item of events) {
      expect(item.fee, `${item.slug} fee`).toBeNull();
      expect(item.team, `${item.slug} team rule`).toBeNull();
      expect(item.rules, `${item.slug} rules`).toBeNull();
      expect(item.eligibility, `${item.slug} eligibility`).toBeNull();
    }
  });
});
