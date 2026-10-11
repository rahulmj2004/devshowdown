import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventCard } from "@/components/events/event-card";
import { events } from "@/config/events";

const event = events[0];

describe("EventCard", () => {
  it("shows the event and links to its details page", () => {
    render(<EventCard event={event} />);
    expect(
      screen.getByRole("heading", { name: event.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(event.tagline)).toBeInTheDocument();
    expect(screen.getByText(event.summary)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `Learn more about ${event.title}` }),
    ).toHaveAttribute("href", `/events/${event.slug}`);
  });

  it("has no register button of its own: teams register once for the event", () => {
    render(<EventCard event={event} />);
    expect(screen.queryByRole("link", { name: /register/i })).toBeNull();
    expect(screen.queryByText(/registration/i)).toBeNull();
  });

  it("marks unconfirmed details as TBA instead of inventing them", () => {
    render(
      <EventCard
        event={{ ...event, format: null, teamSize: null, eligibility: null }}
      />,
    );
    expect(screen.getAllByText("TBA")).toHaveLength(3);
  });

  it("shows confirmed details when configured", () => {
    render(
      <EventCard
        event={{
          ...event,
          format: "Two rounds",
          teamSize: "Solo",
          eligibility: null,
        }}
      />,
    );
    expect(screen.getByText("Two rounds")).toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getAllByText("TBA")).toHaveLength(1);
  });

  it("shows an entry fee only once the organizers have confirmed one", () => {
    const { rerender } = render(<EventCard event={event} />);
    expect(screen.queryByText("Entry fee")).toBeNull();

    rerender(<EventCard event={{ ...event, fee: 100 }} />);
    expect(screen.getByText("Entry fee")).toBeInTheDocument();
    expect(screen.getByText("₹100")).toBeInTheDocument();
  });
});

describe("event configuration", () => {
  it("lists the five competitions in the order of the day, without inventing their details", () => {
    expect(events.map((item) => item.title)).toEqual([
      "Debugging",
      "Speed Typing",
      "Blind Coding",
      "Treasure Hunt",
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
