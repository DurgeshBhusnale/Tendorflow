const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

// Rupees with Indian digit grouping. Whole amounts read as `45,200`; anything
// with paise always shows both decimal places, so money never renders as
// `8,753.5`. Two formatters because Intl fixes the digit count per instance.
const rupeesFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const rupeesAndPaiseFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Renders an ISO-8601 (UTC) timestamp in Asia/Kolkata, per PRD §5. */
export function formatDate(isoTimestamp: string): string {
  return dateFormatter.format(new Date(isoTimestamp));
}

/** Formats a decimal string (the API returns money as strings) as INR. */
export function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return Number.isInteger(value)
    ? rupeesFormatter.format(value)
    : rupeesAndPaiseFormatter.format(value);
}
