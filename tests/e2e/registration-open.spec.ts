import { expect, test, type Page } from "@playwright/test";

/**
 * Runs against the server started with REGISTRATION_STATUS=open, a ₹50
 * development test fee, no database and no payment gateway. That exercises
 * the real flow, Server Actions and mock gateway end to end, in demo mode.
 * The demo store is shared by every test here, so each uses its own email.
 */
const uniqueEmail = () =>
  `asha.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

async function fillDetails(page: Page, email: string) {
  await page.getByLabel("Full name").fill("Asha Menon");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("College or organization").fill("Example College");
}

async function reachPayment(page: Page, email: string) {
  await page.goto("/register?event=coding-challenge");
  await page.getByRole("button", { name: "Continue" }).click();
  await fillDetails(page, email);
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Continue to payment · ₹50" }).click();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
}

test("validates every step before anything is submitted", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("Choose at least one competition."),
  ).toBeVisible();

  await page.getByRole("checkbox", { name: "Coding", exact: true }).check({
    force: true,
  });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeFocused();

  await fillDetails(page, "not-an-email");
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();

  await page.getByLabel("Email address").fill(uniqueEmail());
  await page.getByRole("button", { name: "Review" }).click();
  await expect(
    page.getByRole("heading", { name: "Review and confirm" }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo mode: submissions are not saved"),
  ).toBeVisible();
  await expect(
    page.getByText("Development fee override is active"),
  ).toBeVisible();

  // Going back keeps what was typed.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Menon");
  await page.getByRole("button", { name: "Review" }).click();

  await page.getByRole("button", { name: "Continue to payment · ₹50" }).click();
  await expect(
    page.getByText("You must agree to the rules and privacy notice."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment" })).toHaveCount(0);
});

test("survives a failed payment, a closed checkout and a refresh, then confirms once", async ({
  page,
}) => {
  await reachPayment(page, uniqueEmail());
  const reference = await page
    .getByText(/^DEMO-[A-Z0-9]{8}$/)
    .first()
    .innerText();

  // Nothing is confirmed just because the details were saved.
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo run complete")).toHaveCount(0);

  // The participant closes checkout without paying.
  await page.getByRole("button", { name: "Pay ₹50" }).click();
  await expect(
    page.getByText("Mock checkout · development only"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close checkout" }).click();
  await expect(
    page.getByText("Checkout was closed before paying"),
  ).toBeVisible();

  // A payment attempt fails.
  await page.getByRole("button", { name: "Pay ₹50" }).click();
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(page.getByText("The last payment attempt failed")).toBeVisible();
  await expect(page.getByText("Demo run complete")).toHaveCount(0);

  // A refresh resumes the same registration; it does not start a new one.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();

  // The retry succeeds.
  await page.getByRole("button", { name: "Try again · ₹50" }).click();
  await page
    .getByRole("button", { name: "Simulate successful payment" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Demo run complete" }),
  ).toBeVisible();

  // The confirmation is honest about what this was.
  await expect(page.getByText(reference)).toBeVisible();
  await expect(
    page.getByText("Demo mode: this is not a real registration"),
  ).toBeVisible();
  await expect(
    page.getByText("Simulated payment: no money was charged"),
  ).toBeVisible();
  await expect(page.getByText(/^mock_pay_/)).toBeVisible();

  // Refreshing a settled registration shows it again, still settled.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Demo run complete" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay/ })).toHaveCount(0);
});

test("refuses a second entry for a competition that is already confirmed", async ({
  page,
}) => {
  const email = uniqueEmail();
  await reachPayment(page, email);
  await page.getByRole("button", { name: "Pay ₹50" }).click();
  await page
    .getByRole("button", { name: "Simulate successful payment" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Demo run complete" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Register someone else" }).click();
  await page.getByRole("checkbox", { name: "Coding", exact: true }).check({
    force: true,
  });
  await page.getByRole("button", { name: "Continue" }).click();
  await fillDetails(page, email.toUpperCase());
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Continue to payment · ₹50" }).click();

  await expect(page.getByText("You're already registered")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment" })).toHaveCount(0);
});

test("a double click on submit creates a single registration", async ({
  page,
}) => {
  await page.goto("/register?event=speed-typing");
  await page.getByRole("button", { name: "Continue" }).click();
  await fillDetails(page, uniqueEmail());
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("checkbox", { name: /I agree/ }).check();

  const submissions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      submissions.push(request.postData() ?? "");
    }
  });
  await page
    .getByRole("button", { name: "Continue to payment · ₹50" })
    .dblclick();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
  expect(submissions.filter((body) => body.includes("fullName"))).toHaveLength(
    1,
  );
});

test("event pages offer registration once it is open", async ({ page }) => {
  await page.goto("/events/speed-typing");
  await page
    .getByRole("link", { name: "Register for this event" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/register\?event=speed-typing$/);
  await expect(
    page.getByRole("checkbox", { name: "Speed Typing" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Debugging" }),
  ).not.toBeChecked();
});

test("a registration cannot be read or paid for without its browser key", async ({
  page,
}) => {
  await reachPayment(page, uniqueEmail());
  const saved = await page.evaluate(() =>
    window.localStorage.getItem("devshowdown:registration"),
  );
  const { reference } = JSON.parse(saved ?? "{}") as { reference: string };
  expect(reference).toMatch(/^DEMO-/);

  // The same reference with someone else's key is treated as unknown.
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      "devshowdown:registration",
      JSON.stringify({ reference, clientKey: "0".repeat(64) }),
    ],
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose your competition" }),
  ).toBeVisible();
  await expect(page.getByText(reference)).toHaveCount(0);
});
