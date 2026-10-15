import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/events",
  "/events/tech-treasure-hunt",
  "/events/speed-typing",
  "/register",
  "/terms",
  "/leaderboard?demo=1",
  "/admin",
];

for (const route of routes) {
  test(`nothing overflows or is clipped horizontally on ${route}`, async ({
    page,
  }) => {
    await page.goto(route);
    const offenders = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const scrollable = (element: Element) =>
        /auto|scroll/.test(getComputedStyle(element).overflowX);
      return [...document.querySelectorAll("body *")]
        .filter((element) => {
          // Decorative layers and deliberate scroll areas may extend past the edge.
          if (element.closest('[aria-hidden="true"], .sr-only')) return false;
          for (let p = element.parentElement; p; p = p.parentElement) {
            if (scrollable(p)) return false;
          }
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 && (rect.right > viewport + 1 || rect.left < -1)
          );
        })
        .slice(0, 5)
        .map(
          (element) =>
            `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`,
        );
    });
    expect(offenders).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}

test("hero essentials are readable without scrolling far", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "DevShowdown" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("link", { name: "Explore Events" }).first(),
  ).toBeInViewport();

  if (isMobile) {
    // Prize pool sits within roughly one extra screen of the top on phones.
    const prize = page.getByText("₹3,000").first();
    const box = await prize.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.y < viewport.height * 1.25).toBeTruthy();
  }
});

test("mobile menu opens, navigates and closes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The menu button only exists on small screens.");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile" });
  await expect(menu).toBeVisible();

  // Items arrive one after another; the last one must still become usable.
  await expect(
    menu.getByRole("link", { name: /^Register$|^Registrations Closed$/ }),
  ).toBeVisible();

  await menu.getByRole("link", { name: "Schedule" }).click();
  await expect(page).toHaveURL(/#schedule$/);
  await expect(menu).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Run of show" }),
  ).toBeInViewport();

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("the site is fully usable with reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  // A motion preference must not make the server and browser markup differ.
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto("/", { waitUntil: "networkidle" });

  // No intro, and the hero is readable immediately rather than mid-animation.
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", "play");
  const heading = page.getByRole("heading", { level: 1, name: "DevShowdown" });
  await expect(heading).toBeVisible();
  expect(
    await page
      .locator(".hero-in")
      .first()
      .evaluate((node) => getComputedStyle(node).opacity),
  ).toBe("1");

  // Scroll-revealed content is present without waiting for an animation.
  await page.locator("#faq").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("heading", { name: "Questions, answered" }),
  ).toBeVisible();

  await page.goto("/register", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Choose your competition" }),
  ).toBeVisible();
  expect(problems).toEqual([]);
  await context.close();
});

test("the intro plays once per session and never blocks the page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "play");
  // The overlay ignores pointer input, so the page is usable underneath it.
  await page.getByRole("link", { name: "Explore Events" }).first().click();
  await expect(page).toHaveURL(/#events$/);

  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", "play");
});
