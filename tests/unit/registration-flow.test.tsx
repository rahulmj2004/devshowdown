import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RegistrationFlow,
  type FlowConfig,
  type FlowEvent,
} from "@/components/registration/registration-flow";
import { ToastProvider } from "@/components/ui/toast";
import type {
  CreateRegistrationResponse,
  PaymentResponse,
  RegistrationSummary,
  StartPaymentResponse,
} from "@/lib/registration/service";

const actions = vi.hoisted(() => ({
  submitRegistration:
    vi.fn<
      (
        values: unknown,
        honeypot?: unknown,
      ) => Promise<CreateRegistrationResponse>
    >(),
  fetchRegistration:
    vi.fn<(access: unknown) => Promise<RegistrationSummary | null>>(),
  beginPayment: vi.fn<(access: unknown) => Promise<StartPaymentResponse>>(),
  verifyPayment:
    vi.fn<(access: unknown, payload: unknown) => Promise<PaymentResponse>>(),
  resolveMockPayment:
    vi.fn<(access: unknown, result: unknown) => Promise<PaymentResponse>>(),
  reportUpiPayment:
    vi.fn<(access: unknown, payload: unknown) => Promise<PaymentResponse>>(),
}));
vi.mock("@/app/register/actions", () => actions);

const STORAGE_KEY = "devshowdown:registration";

const events: FlowEvent[] = [
  {
    slug: "speed-typing",
    title: "Speed Typing",
    tagline: "Fingers faster than thought.",
    accent: "cyan",
    icon: "keyboard",
    open: true,
    team: null,
    feePaise: 0,
    feeConfirmed: false,
  },
  {
    slug: "tech-treasure-hunt",
    title: "Treasure Hunt",
    tagline: "Follow the clues.",
    accent: "lime",
    icon: "compass",
    open: true,
    team: { min: 2, max: 3 },
    feePaise: 0,
    feeConfirmed: false,
  },
];

const paidEvents = events.map((event) => ({
  ...event,
  feePaise: 5000,
  feeConfirmed: true,
}));

const config: FlowConfig = {
  siteName: "DevShowdown",
  status: "open",
  phoneField: "optional",
  allowMultipleEvents: true,
  demo: false,
  paymentMode: "razorpay",
  paymentUnavailableReason: null,
  testFees: false,
  emailConfigured: false,
  contact: { email: null, phone: null },
};

function summary(
  overrides: Partial<RegistrationSummary> = {},
): RegistrationSummary {
  return {
    reference: "DSD-7K2M9QXA",
    status: "confirmed",
    paymentStatus: "not_required",
    amountPaise: 0,
    currency: "INR",
    demo: false,
    testPayment: false,
    fullName: "Asha Menon",
    email: "asha@example.com",
    entries: [
      {
        eventSlug: "speed-typing",
        eventTitle: "Speed Typing",
        teamName: null,
        members: [],
        feePaise: 0,
      },
    ],
    paymentReference: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const pendingSummary = (overrides: Partial<RegistrationSummary> = {}) =>
  summary({
    status: "pending_payment",
    paymentStatus: "pending",
    amountPaise: 5000,
    ...overrides,
  });

function renderFlow(
  props: Partial<Parameters<typeof RegistrationFlow>[0]> & {
    config?: FlowConfig;
  } = {},
) {
  return render(
    <ToastProvider>
      <RegistrationFlow events={events} config={config} {...props} />
    </ToastProvider>,
  );
}

type User = ReturnType<typeof userEvent.setup>;

async function chooseEvent(user: User, title = "Speed Typing") {
  await user.click(screen.getByRole("checkbox", { name: title }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

async function fillDetails(user: User) {
  await user.type(screen.getByLabelText("Full name"), "Asha Menon");
  await user.type(screen.getByLabelText("Email address"), "asha@example.com");
  await user.type(
    screen.getByLabelText("College or organization"),
    "Example College",
  );
}

/** Walks to the review step with a valid solo entry. */
async function reachReview(user: User) {
  await chooseEvent(user);
  await fillDetails(user);
  await user.click(screen.getByRole("button", { name: "Review" }));
  await screen.findByRole("heading", { name: "Review and confirm" });
}

async function confirm(
  user: User,
  name: string | RegExp = "Confirm registration",
) {
  await user.click(screen.getByRole("checkbox", { name: /I agree/ }));
  await user.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
  actions.fetchRegistration.mockResolvedValue(null);
  window.localStorage.clear();
});

describe("RegistrationFlow: choosing and validating", () => {
  it("will not continue until a competition is chosen", async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByText("Choose at least one competition."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose your competition" }),
    ).toBeInTheDocument();
  });

  it("shows inline errors, focuses the first one, and does not call the server", async () => {
    const user = userEvent.setup();
    renderFlow();
    await chooseEvent(user);
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Full name")).toHaveFocus(),
    );
    expect(actions.submitRegistration).not.toHaveBeenCalled();
  });

  it("pre-selects the event from the link the visitor followed", () => {
    renderFlow({ defaultEventSlug: "tech-treasure-hunt" });
    expect(
      screen.getByRole("checkbox", { name: "Treasure Hunt" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Speed Typing" }),
    ).not.toBeChecked();
  });

  it("offers a single choice when multiple entries are not allowed", () => {
    renderFlow({ config: { ...config, allowMultipleEvents: false } });
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("is disabled until registration opens", () => {
    renderFlow({
      config: { ...config, status: "not_open" },
      events: events.map((event) => ({ ...event, open: false })),
    });
    expect(
      screen.getByRole("button", { name: "Registration not open yet" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Speed Typing" }),
    ).toBeDisabled();
  });

  it("collects team members for a team event and enforces its size", async () => {
    const user = userEvent.setup();
    renderFlow();
    await chooseEvent(user, "Treasure Hunt");
    await fillDetails(user);

    // A team of 2-3 starts with one extra member row and allows one more.
    expect(screen.getByLabelText("Team member 2 name")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Enter a team name.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter this team member's name."),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Team name for Treasure Hunt"),
      "Null Pointers",
    );
    await user.type(screen.getByLabelText("Team member 2 name"), "Ravi Kumar");
    await user.click(screen.getByRole("button", { name: "Add team member" }));
    await user.type(screen.getByLabelText("Team member 3 name"), "Meera Nair");
    expect(
      screen.queryByRole("button", { name: "Add team member" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Review" }));
    const review = await screen.findByRole("table", { name: "Fee breakdown" });
    expect(
      within(review).getByText(
        /Team Null Pointers · with Ravi Kumar, Meera Nair/,
      ),
    ).toBeInTheDocument();
  });
});

describe("RegistrationFlow: review and submit", () => {
  it("shows the details, the fee breakdown and the total before submitting", async () => {
    const user = userEvent.setup();
    renderFlow({ events: paidEvents });
    await reachReview(user);

    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Fee breakdown" });
    expect(
      within(table).getByRole("rowheader", { name: /Speed Typing/ }),
    ).toBeInTheDocument();
    expect(within(table).getAllByText("₹50")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Continue to payment · ₹50" }),
    ).toBeInTheDocument();
  });

  it("requires agreement before anything is sent", async () => {
    const user = userEvent.setup();
    renderFlow();
    await reachReview(user);
    await user.click(
      screen.getByRole("button", { name: "Confirm registration" }),
    );

    expect(
      screen.getByText("You must agree to the rules and privacy notice."),
    ).toBeInTheDocument();
    expect(actions.submitRegistration).not.toHaveBeenCalled();
  });

  it("confirms success only when the server reports it", async () => {
    actions.submitRegistration.mockResolvedValue({
      status: "created",
      registration: summary(),
    });
    const user = userEvent.setup();
    renderFlow();
    await reachReview(user);
    await confirm(user);

    expect(
      await screen.findByRole("heading", { name: "You're in the arena" }),
    ).toBeInTheDocument();
    expect(screen.getByText("DSD-7K2M9QXA")).toBeInTheDocument();
    expect(screen.getByText("No payment required")).toBeInTheDocument();

    const [values, honeypot] = actions.submitRegistration.mock.calls[0];
    expect(values).toMatchObject({
      email: "asha@example.com",
      eventSlugs: ["speed-typing"],
      agree: true,
    });
    expect((values as { clientKey: string }).clientKey).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(honeypot).toBe("");
  });

  it("labels a demo run as not a real registration", async () => {
    actions.submitRegistration.mockResolvedValue({
      status: "created",
      registration: summary({ reference: "DEMO-7K2M9QXA", demo: true }),
    });
    const user = userEvent.setup();
    renderFlow({ config: { ...config, demo: true, paymentMode: "mock" } });
    await reachReview(user);
    expect(
      screen.getByText("Demo mode: submissions are not saved"),
    ).toBeInTheDocument();
    await confirm(user);

    expect(
      await screen.findByText("Demo mode: this is not a real registration"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Demo run complete" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("You're in the arena")).toBeNull();
  });

  it("explains duplicate registrations", async () => {
    actions.submitRegistration.mockResolvedValue({
      status: "duplicate",
      eventTitles: ["Speed Typing"],
    });
    const user = userEvent.setup();
    renderFlow();
    await reachReview(user);
    await confirm(user);

    expect(
      await screen.findByText("You're already registered"),
    ).toBeInTheDocument();
    expect(screen.queryByText("You're in the arena")).toBeNull();
  });

  it("reports a failure when the request itself fails", async () => {
    actions.submitRegistration.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    renderFlow();
    await reachReview(user);
    await confirm(user);

    expect(
      await screen.findByText("Your registration was not saved"),
    ).toBeInTheDocument();
  });

  it("returns to the right step for errors found by the server", async () => {
    actions.submitRegistration.mockResolvedValue({
      status: "invalid",
      fieldErrors: { email: "Enter a valid email address." },
    });
    const user = userEvent.setup();
    renderFlow();
    await reachReview(user);
    await confirm(user);

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your details" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Asha Menon");
  });

  it("sends a retry with the same key, so it cannot create a duplicate", async () => {
    actions.submitRegistration
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ status: "created", registration: summary() });
    const user = userEvent.setup();
    renderFlow();
    await reachReview(user);
    await confirm(user);
    await screen.findByText("Your registration was not saved");
    await user.click(
      screen.getByRole("button", { name: "Confirm registration" }),
    );
    await screen.findByRole("heading", { name: "You're in the arena" });

    const keys = actions.submitRegistration.mock.calls.map(
      ([values]) => (values as { clientKey: string }).clientKey,
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it("blocks paid registration while payment is not configured", async () => {
    const user = userEvent.setup();
    renderFlow({
      events: paidEvents,
      config: {
        ...config,
        paymentMode: "unconfigured",
        paymentUnavailableReason: "Razorpay keys have not been configured.",
      },
    });
    await reachReview(user);

    expect(
      screen.getByText("Online payment is not configured"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue to payment · ₹50" }),
    ).toBeDisabled();
  });
});

describe("RegistrationFlow: payment", () => {
  const mockConfig: FlowConfig = { ...config, paymentMode: "mock", demo: true };
  const mockSession: StartPaymentResponse = {
    status: "ready",
    checkout: {
      mode: "mock",
      orderId: "mock_order_1",
      amountPaise: 5000,
      currency: "INR",
    },
  };

  async function reachPayment(user: User) {
    actions.submitRegistration.mockResolvedValue({
      status: "created",
      registration: pendingSummary({ demo: true, testPayment: true }),
    });
    renderFlow({ events: paidEvents, config: mockConfig });
    await reachReview(user);
    await confirm(user, "Continue to payment · ₹50");
    await screen.findByRole("heading", { name: "Payment" });
  }

  it("stops at payment for a registration with a fee, without claiming success", async () => {
    const user = userEvent.setup();
    await reachPayment(user);

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay ₹50" })).toBeInTheDocument();
    expect(screen.queryByText("You're in the arena")).toBeNull();
    expect(screen.queryByText("Demo run complete")).toBeNull();
  });

  it("labels the mock checkout and confirms only what the server returns", async () => {
    actions.beginPayment.mockResolvedValue(mockSession);
    actions.resolveMockPayment.mockResolvedValue({
      status: "settled",
      registration: summary({
        paymentStatus: "paid",
        amountPaise: 5000,
        demo: true,
        testPayment: true,
        paymentReference: "mock_pay_1",
      }),
    });
    const user = userEvent.setup();
    await reachPayment(user);
    await user.click(screen.getByRole("button", { name: "Pay ₹50" }));

    expect(
      await screen.findByText("Mock checkout · development only"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Simulate successful payment" }),
    );

    expect(
      await screen.findByText("Simulated payment: no money was charged"),
    ).toBeInTheDocument();
    expect(screen.getByText("mock_pay_1")).toBeInTheDocument();
    expect(actions.resolveMockPayment).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "DSD-7K2M9QXA" }),
      "success",
    );
  });

  it("keeps the registration pending after a failed payment and offers a retry", async () => {
    actions.beginPayment.mockResolvedValue(mockSession);
    actions.resolveMockPayment.mockResolvedValue({
      status: "settled",
      registration: pendingSummary({ paymentStatus: "failed", demo: true }),
    });
    const user = userEvent.setup();
    await reachPayment(user);
    await user.click(screen.getByRole("button", { name: "Pay ₹50" }));
    await user.click(
      await screen.findByRole("button", { name: "Simulate failed payment" }),
    );

    expect(
      await screen.findByText("The last payment attempt failed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again · ₹50" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Demo run complete")).toBeNull();
    // Still exactly one registration: the retry reuses it.
    expect(actions.submitRegistration).toHaveBeenCalledTimes(1);
  });

  it("leaves the registration pending when checkout is closed", async () => {
    actions.beginPayment.mockResolvedValue(mockSession);
    const user = userEvent.setup();
    await reachPayment(user);
    await user.click(screen.getByRole("button", { name: "Pay ₹50" }));
    await user.click(
      await screen.findByRole("button", { name: "Close checkout" }),
    );

    expect(
      screen.getByText("Checkout was closed before paying"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay ₹50" })).toBeEnabled();
    expect(actions.resolveMockPayment).not.toHaveBeenCalled();
  });

  it("does not show success when the server rejects the payment proof", async () => {
    actions.beginPayment.mockResolvedValue(mockSession);
    actions.resolveMockPayment.mockResolvedValue({
      status: "rejected",
      registration: pendingSummary(),
    });
    const user = userEvent.setup();
    await reachPayment(user);
    await user.click(screen.getByRole("button", { name: "Pay ₹50" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Simulate successful payment",
      }),
    );

    expect(
      await screen.findByText("We could not verify that payment"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Demo run complete")).toBeNull();
  });

  it("tells the participant not to pay again while verification is pending", async () => {
    actions.submitRegistration.mockResolvedValue({
      status: "created",
      registration: pendingSummary({ paymentStatus: "verification_required" }),
    });
    const user = userEvent.setup();
    renderFlow({ events: paidEvents });
    await reachReview(user);
    await confirm(user, "Continue to payment · ₹50");

    expect(
      await screen.findByText("We are verifying your payment"),
    ).toBeInTheDocument();
    expect(screen.getByText("Verification required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Check again" }),
    ).toBeInTheDocument();
  });
});

describe("RegistrationFlow: refresh", () => {
  const access = { reference: "DSD-7K2M9QXA", clientKey: "ab".repeat(32) };

  it("remembers only the reference and key, never personal details", async () => {
    actions.submitRegistration.mockResolvedValue({
      status: "created",
      registration: summary(),
    });
    const user = userEvent.setup();
    renderFlow();
    await reachReview(user);
    await confirm(user);
    await screen.findByRole("heading", { name: "You're in the arena" });

    const stored = window.localStorage.getItem(STORAGE_KEY) ?? "";
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual([
      "clientKey",
      "reference",
    ]);
    expect(stored).not.toContain("asha@example.com");
  });

  it("resumes a pending registration at payment instead of starting again", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
    actions.fetchRegistration.mockResolvedValue(pendingSummary());
    renderFlow({ events: paidEvents });

    expect(
      await screen.findByRole("heading", { name: "Payment" }),
    ).toBeInTheDocument();
    expect(actions.fetchRegistration).toHaveBeenCalledWith(access);
    expect(actions.submitRegistration).not.toHaveBeenCalled();
  });

  it("shows the confirmation again for a registration that is already settled", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
    actions.fetchRegistration.mockResolvedValue(
      summary({
        paymentStatus: "paid",
        amountPaise: 5000,
        paymentReference: "pay_1",
      }),
    );
    renderFlow({ events: paidEvents });

    expect(
      await screen.findByRole("heading", { name: "You're in the arena" }),
    ).toBeInTheDocument();
    expect(screen.getByText("pay_1")).toBeInTheDocument();
  });

  it("starts fresh when the saved registration no longer exists", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
    actions.fetchRegistration.mockResolvedValue(null);
    renderFlow();

    expect(
      await screen.findByRole("heading", { name: "Choose your competition" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores tampered saved data", () => {
    window.localStorage.setItem(STORAGE_KEY, '{"reference":"x","clientKey":1}');
    renderFlow();
    expect(
      screen.getByRole("heading", { name: "Choose your competition" }),
    ).toBeInTheDocument();
    expect(actions.fetchRegistration).not.toHaveBeenCalled();
  });
});

describe("RegistrationFlow: UPI payment", () => {
  const upiConfig: FlowConfig = { ...config, paymentMode: "upi" };

  async function reachUpiCheckout(user: User) {
    actions.submitRegistration.mockResolvedValue({
      status: "created",
      registration: pendingSummary(),
    });
    actions.beginPayment.mockResolvedValue({
      status: "ready",
      checkout: {
        mode: "upi",
        vpa: "rahul@okaxis",
        payeeName: "Rahul M J",
        amountPaise: 5000,
        currency: "INR",
        note: "DSD-7K2M9QXA",
      },
    });
    renderFlow({ events: paidEvents, config: upiConfig });
    await reachReview(user);
    await confirm(user, "Continue to payment · ₹50");
    await user.click(
      await screen.findByRole("button", { name: "Pay ₹50 by UPI" }),
    );
    return screen.findByRole("form", { name: "Pay ₹50 by UPI" });
  }

  it("shows the QR code, the UPI ID and the reference to pay against", async () => {
    const user = userEvent.setup();
    const checkout = await reachUpiCheckout(user);

    expect(
      within(checkout).getByTitle("UPI QR code to pay ₹50 to Rahul M J"),
    ).toBeInTheDocument();
    expect(within(checkout).getByText("rahul@okaxis")).toBeInTheDocument();
    expect(within(checkout).getByText("DSD-7K2M9QXA")).toBeInTheDocument();
    expect(
      within(checkout).getByRole("link", { name: "Open my UPI app" }),
    ).toHaveAttribute(
      "href",
      "upi://pay?pa=rahul@okaxis&pn=Rahul%20M%20J&am=50.00&cu=INR&tn=DSD-7K2M9QXA",
    );
  });

  it("asks for a 12-digit transaction ID before sending anything", async () => {
    const user = userEvent.setup();
    const checkout = await reachUpiCheckout(user);

    await user.type(
      within(checkout).getByLabelText("UPI transaction ID (UTR)"),
      "4123",
    );
    await user.click(
      within(checkout).getByRole("button", { name: /I have paid/ }),
    );

    expect(
      screen.getByText(
        "Enter the 12-digit UPI transaction ID from your payment receipt.",
      ),
    ).toBeInTheDocument();
    expect(actions.reportUpiPayment).not.toHaveBeenCalled();
  });

  it("reports the payment and waits for a coordinator instead of confirming", async () => {
    actions.reportUpiPayment.mockResolvedValue({
      status: "settled",
      registration: pendingSummary({ paymentStatus: "verification_required" }),
    });
    const user = userEvent.setup();
    const checkout = await reachUpiCheckout(user);

    await user.type(
      within(checkout).getByLabelText("UPI transaction ID (UTR)"),
      "412345678901",
    );
    await user.click(
      within(checkout).getByRole("button", { name: /I have paid/ }),
    );

    expect(
      await screen.findByText("A coordinator is checking your payment"),
    ).toBeInTheDocument();
    expect(actions.reportUpiPayment).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "DSD-7K2M9QXA" }),
      { transactionId: "412345678901" },
    );
    expect(screen.queryByText("You're in the arena")).toBeNull();
  });

  it("says so when the transaction ID was already used", async () => {
    actions.reportUpiPayment.mockResolvedValue({
      status: "rejected",
      registration: pendingSummary(),
      reason: "transaction_id_in_use",
    });
    const user = userEvent.setup();
    const checkout = await reachUpiCheckout(user);

    await user.type(
      within(checkout).getByLabelText("UPI transaction ID (UTR)"),
      "412345678901",
    );
    await user.click(
      within(checkout).getByRole("button", { name: /I have paid/ }),
    );

    expect(
      await screen.findByText("That transaction ID has already been used"),
    ).toBeInTheDocument();
  });
});
