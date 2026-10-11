/** A UPI ID (VPA), e.g. "name@okhdfcbank". */
export const UPI_VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9]{2,64}$/;

/**
 * The 12-digit reference every UPI app prints on a payment receipt (shown as
 * "UTR", "UPI Ref No." or "UPI transaction ID" depending on the app).
 */
export const UPI_TRANSACTION_ID_PATTERN = /^\d{12}$/;

export interface UpiPayee {
  vpa: string;
  payeeName: string;
}

/** Returns the payee only when both parts are set and the UPI ID is well formed. */
export function resolveUpiPayee(config: {
  vpa: string | null;
  payeeName: string | null;
}): UpiPayee | null {
  const vpa = config.vpa?.trim();
  const payeeName = config.payeeName?.trim();
  if (!vpa || !payeeName || !UPI_VPA_PATTERN.test(vpa)) return null;
  return { vpa, payeeName };
}

/** Order id for a UPI payment. There is no gateway, so the server makes one. */
export const upiOrderId = (reference: string) => `upi_${reference}`;

/**
 * The `upi://pay` link behind the QR code and the "Open UPI app" button. The
 * amount is fixed in the link and the note carries the registration reference
 * so organizers can match the payment in their own UPI history.
 */
export function buildUpiUri(input: {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  note: string;
}): string {
  const amount = (input.amountPaise / 100).toFixed(2);
  // `pa` is left readable: several UPI apps do not decode an escaped "@".
  return `upi://pay?pa=${input.vpa}&pn=${encodeURIComponent(input.payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(input.note)}`;
}
