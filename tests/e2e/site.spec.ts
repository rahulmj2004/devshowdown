import { expect, test } from "@playwright/test";
import { siteConfig } from "../../config/site";

/** Set while registration is handled by an external (Google) form. */
const { formUrl } = siteConfig.registration;

test.describe("landing page", () => {
  test("presents the event identity without inventing details", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DevShowdown/);
    await expect(
      page.getByRole("heading", { level: 1, name: "DevShowdown" }),
    ).toBeVisible();
    await expect(page.getByText("₹15,000").first()).toBeVisible();

    for (const title of [
      "Debugging",
      "Blind Coding",
      "Treasure Hunt",
      "Speed Typing",
      "Coding",
    ]) {
      await expect(
        page
          .locator("#events")
          .getByRole("heading", { level: 3, name: title, exact: true }),
      ).toBeVisible();
    }
    // Nothing unconfirmed is presented as fact.
    await expect(page.getByText("Distribution to be announced")).toBeVisible();
    await expect(
      page.getByText("Final amount awaiting organizer confirmation"),
    ).toBeVisible();
    await expect(
      page.locator("#schedule").getByText("Morning session"),
    ).toBeVisible();
    await expect(page.locator("#sponsors")).toHaveCount(0);
    // The date is confirmed, so the countdown runs and the coordinators show.
    await expect(
      page.getByText("Countdown starts once the event date is announced."),
    ).toHaveCount(0);
    for (const name of ["Rahul M J", "Advaith U", "Devinandha VR"]) {
      await expect(
        page
          .locator("#coordinators")
          .getByRole("heading", { level: 3, name, exact: true }),
      ).toBeVisible();
    }
    // No sample leaderboard rows on the front page before results exist.
    await expect(page.getByText("Demo Player")).toHaveCount(0);
  });

  test("main navigation reaches every section", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });

    await nav.getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(/#faq$/);
    await expect(
      page.getByRole("heading", { name: "Questions, answered" }),
    ).toBeInViewport();

    await expect(nav.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await nav.getByRole("link", { name: "Prizes" }).click();
    await expect(page).toHaveURL(/#prizes$/);
    await nav.getByRole("link", { name: "Events" }).click();
    await expect(page).toHaveURL(/#events$/);
    await expect(
      page.getByRole("heading", { name: "Choose your arena" }),
    ).toBeInViewport();

    // The same anchors work from another page.
    await page.goto("/leaderboard");
    await nav.getByRole("link", { name: "Schedule" }).click();
    await expect(page).toHaveURL(/\/#schedule$/);
    await expect(
      page.getByRole("heading", { name: "Run of show" }),
    ).toBeInViewport();
  });

  test("the header register button and footer links work", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Register" })
      .click();
    await expect(page).toHaveURL(/\/register$/);

    for (const [name, path] of [
      ["Leaderboard", "/leaderboard"],
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
    ]) {
      await page
        .getByRole("contentinfo")
        .getByRole("link", { name, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("loads without console errors or failed requests", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) {
        problems.push(`${response.status()} ${response.url()}`);
      }
    });

    for (const route of ["/", "/events", "/events/blind-coding", "/register"]) {
      await page.goto(route, { waitUntil: "networkidle" });
    }
    expect(problems).toEqual([]);
  });

  test("FAQ answers expand and flag unconfirmed policies", async ({ page }) => {
    await page.goto("/#faq");
    const question = page.getByText("When and where does it take place?");
    await question.click();
    const item = page.locator("details", { has: question });
    await expect(item).toHaveAttribute("open", "");
    await expect(item.getByText("Awaiting confirmation")).toBeVisible();
  });

  test("every internal link resolves", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => [
        ...new Set(
          links.map((link) => (link.getAttribute("href") ?? "").split("#")[0]),
        ),
      ]);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs.filter(Boolean)) {
      const response = await request.get(href);
      expect(response.status(), `GET ${href}`).toBe(200);
    }
  });
});

test.describe("events", () => {
  test("a card opens a working details page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Explore Events" }).first().click();
    await expect(page).toHaveURL(/#events$/);
    await page.getByRole("link", { name: "All events" }).click();
    await expect(page).toHaveURL(/\/events$/);

    await page
      .getByRole("link", { name: "Learn more about Debugging" })
      .click();
    await expect(page).toHaveURL(/\/events\/code-debugging$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Debugging" }),
    ).toBeVisible();
    // Next keeps the pages just left in the DOM, hidden, so match visible text.
    await expect(
      page.locator("p:visible", { hasText: "Find the bug. Fix the chaos." }),
    ).toHaveCount(1);
    for (const section of [
      "Overview",
      "Rules",
      "Scoring system",
      "Required tools",
    ]) {
      await expect(
        page.getByRole("heading", { level: 2, name: section }),
      ).toBeVisible();
    }
    // Unconfirmed rules are labelled, not made up.
    await expect(
      page.getByText("The rules for this event have not been published yet."),
    ).toBeVisible();
  });

  test("unknown events show the not-found page", async ({ page }) => {
    await page.goto("/events/does-not-exist");
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
});

test.describe("registration (default state)", () => {
  test("sends people to the external registration form when one is set", async ({
    page,
  }) => {
    test.skip(formUrl === null, "no external form is configured");
    await page.goto("/register");
    const link = page.getByRole("link", { name: /Open the registration form/ });
    await expect(link).toHaveAttribute("href", formUrl!);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("does not accept entries before registration opens", async ({
    page,
  }) => {
    test.skip(formUrl !== null, "the external form replaces the built-in one");
    await page.goto("/register");
    await expect(
      page.getByText("Registration not open yet").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Registration not open yet" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: "Debugging" }),
    ).toBeDisabled();
    // With no environment at all, the page says exactly what is not wired up.
    await expect(page.getByText("Demo: nothing is saved")).toBeVisible();
    await expect(page.getByText("Mock gateway (no real money)")).toBeVisible();
  });

  test("the payment webhook is off when Razorpay is not configured", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/razorpay", {
      data: { event: "payment.captured" },
      headers: { "x-razorpay-signature": "0".repeat(64) },
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      result: "webhook_not_configured",
    });
  });
});

test.describe("leaderboard", () => {
  test("shows an explicit empty state, with opt-in demo data", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expect(page.getByText("No results published yet")).toBeVisible();

    await page
      .getByRole("link", { name: "Preview the layout with demonstration data" })
      .click();
    await expect(page.getByText("Demonstration data")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(5);

    await page
      .getByRole("navigation", { name: "Filter leaderboard by event" })
      .getByRole("link", { name: "Speed Typing" })
      .click();
    await expect(page).toHaveURL(/event=speed-typing/);
    await expect(page.getByRole("table")).toHaveCount(1);
    await expect(
      page.getByRole("rowheader", { name: "Demo Player A" }),
    ).toBeVisible();
  });
});

test.describe("admin (no backend connected)", () => {
  test("is labelled as a prototype and exposes no data", async ({
    page,
    request,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByText("Prototype: no authentication or database is connected"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save settings" }),
    ).toBeDisabled();

    const exportResponse = await request.get("/admin/registrations/export");
    expect(exportResponse.status()).toBe(401);

    await page.goto("/admin/login");
    await expect(
      page.getByText("Authentication is not configured"),
    ).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveCount(0);
  });
});
