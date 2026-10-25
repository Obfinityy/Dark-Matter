// Dark Matter — UPI payment details (owner order 25 Oct 2026).
//
// Simplified activation: NO gateway, NO OTP, NO third-party checkout.
// The user pays Rs 10,000 to the Obfinity UPI ID from ANY UPI app, then
// submits their payment claim (phone, WhatsApp, account details, UTR).
// The admin verifies the money arrived in the bank and activates the
// account for 1 day. A claim NEVER auto-activates anything.
//
// The UPI ID is a public payment address — it is meant to be shown to
// payers (QR + copyable text). It is not a secret.

export const UPI_PAYEE_ID = '6376411796@ibl';
export const UPI_PAYEE_NAME = 'Obfinity';
export const UPI_AMOUNT_INR = 10000;
export const UPI_CURRENCY = 'INR';
// One payment buys this many days of account access, counted from the
// moment the admin verifies the claim (not from the payment).
export const UPI_ACCESS_DAYS = 1;

/** Exact UPI deep link shown on the pay screen and encoded in the QR. */
export function upiPayLink() {
  const params = new URLSearchParams({
    pa: UPI_PAYEE_ID,
    pn: UPI_PAYEE_NAME,
    am: String(UPI_AMOUNT_INR),
    cu: UPI_CURRENCY,
  });
  return `upi://pay?${params.toString()}`;
}

/** Everything the pay screen needs, in one object. */
export function upiPayDetails() {
  return {
    upiId: UPI_PAYEE_ID,
    payeeName: UPI_PAYEE_NAME,
    amountInr: UPI_AMOUNT_INR,
    currency: UPI_CURRENCY,
    accessDays: UPI_ACCESS_DAYS,
    deepLink: upiPayLink(),
  };
}
